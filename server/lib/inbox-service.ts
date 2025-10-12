import crypto from "node:crypto";
import {
  InboxChannel,
  InboxImportance,
  InboxStatus,
  InboxType,
  PiiClass,
  Prisma,
} from "@prisma/client";
import { prisma } from "./prisma";
import { APP_TENANT_ID } from "../config";
import {
  InboxPayloadSchema,
  InboxPayloadInput,
  InboxContent,
  InboxMeta,
} from "../../shared/inbox";
import { isEncryptionActive, wrapContent } from "./encryption";
import { captureError, traceMessage } from "./observability";
import { messageRateLimiter, RateLimiter } from "./rate-limit";
import { writeAuditLog } from "./audit";

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_REGEX = /\+?\d[\d\s\-()]{8,}/;
const WALLET_REGEX = /(0:)?[a-f0-9]{64}/i;

const PII_PRIORITY: Record<PiiClass, number> = {
  none: 0,
  personal: 1,
  sensitive: 2,
};

const fallbackTenant = APP_TENANT_ID || "default";

const channelRateLimiters: Partial<Record<InboxChannel, RateLimiter>> = {
  chat: messageRateLimiter,
  toast: new RateLimiter(120, 60_000),
  email: new RateLimiter(20, 60_000),
  push: new RateLimiter(60, 60_000),
  log: new RateLimiter(240, 60_000),
};

function getRateLimiter(channel: InboxChannel) {
  return channelRateLimiters[channel] ?? messageRateLimiter;
}

function normalizeTenant(tenantId?: string | null) {
  return tenantId?.trim() || fallbackTenant;
}

function computeHashForContent(content: InboxContent, meta?: InboxMeta | null) {
  const serialized = JSON.stringify({ content, meta: meta ?? {} });
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

function collectStrings(value: unknown, bucket: string[]) {
  if (typeof value === "string") {
    bucket.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, bucket);
    return;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectStrings(nested, bucket);
    }
  }
}

function escalatePii(current: PiiClass, next: PiiClass) {
  return PII_PRIORITY[next] > PII_PRIORITY[current] ? next : current;
}

function classifyPayload(payload: InboxPayloadInput) {
  const strings: string[] = [];
  collectStrings((payload.content as any)?.args ?? {}, strings);
  const tags = new Set<string>();
  let level = payload.piiClass as PiiClass;

  for (const raw of strings) {
    const value = raw.trim();
    if (!value) continue;
    if (EMAIL_REGEX.test(value)) {
      tags.add("email");
      level = escalatePii(level, "personal");
    }
    if (PHONE_REGEX.test(value)) {
      tags.add("phone");
      level = escalatePii(level, "personal");
    }
    if (WALLET_REGEX.test(value)) {
      tags.add("wallet");
      level = escalatePii(level, "sensitive");
    }
  }

  return { tags: Array.from(tags), level } as const;
}

function summarizeContent(content: InboxContent): InboxContent {
  const args = Object.entries(content.args ?? {}).reduce<
    Record<string, unknown>
  >((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key] = "[redacted]";
    } else if (Array.isArray(value)) {
      acc[key] = value.length;
    } else if (value && typeof value === "object") {
      acc[key] = "[object]";
    } else {
      acc[key] = value ?? null;
    }
    return acc;
  }, {});
  return {
    key: content.key,
    args,
  } as InboxContent;
}

async function resolveThreadId(
  payload: InboxPayloadInput & { tenantId: string },
) {
  if (payload.threadId) {
    const existing = await prisma.inboxThread.findUnique({
      where: { id: payload.threadId },
    });
    if (existing) {
      return existing;
    }
  }

  const existingByContext = await prisma.inboxThread.findFirst({
    where: {
      tenantId: payload.tenantId,
      conversationId: payload.conversationId ?? undefined,
      orderId: payload.orderId ?? undefined,
    },
  });
  if (existingByContext) {
    return existingByContext;
  }

  return prisma.inboxThread.create({
    data: {
      tenantId: payload.tenantId,
      conversationId: payload.conversationId ?? null,
      orderId: payload.orderId ?? null,
      metadata: payload.meta ? { ...payload.meta } : undefined,
      dedupeHash: payload.dedupeKey ?? null,
    },
  });
}

async function ensureRateLimit(
  payload: InboxPayloadInput & { tenantId: string },
) {
  const limiter = getRateLimiter(payload.channel as InboxChannel);
  const identity = payload.address || payload.userId || payload.conversationId;
  const key = [payload.tenantId, payload.channel, identity ?? "anonymous"].join(
    ":",
  );
  const result = limiter.consume(key, 1);
  if (!result.allowed) {
    const error = new Error("rate_limited");
    (error as any).statusCode = 429;
    (error as any).retryAfter = result.retryAfter;
    throw error;
  }
}

function buildDedupeKey(
  payload: InboxPayloadInput & { tenantId: string },
  threadId: string,
) {
  if (payload.dedupeKey) return payload.dedupeKey;
  return computeHashForContent(payload.content, payload.meta) + ":" + threadId;
}

function sanitizeMeta(meta?: InboxMeta) {
  if (!meta) return null;
  return { ...meta };
}

function shouldAutoDeliver(channel: InboxChannel) {
  return channel === "chat" || channel === "toast" || channel === "log";
}

type AdapterContext = {
  item: Prisma.InboxItem;
  payload: InboxPayloadInput & { tenantId: string };
};

type InboxAdapter = (ctx: AdapterContext) => Promise<void>;

const adapterMap: Record<InboxChannel, InboxAdapter> = {
  async chat(ctx) {
    await prisma.inboxItem.update({
      where: { id: ctx.item.id },
      data: {
        status: "delivered",
        deliveredAt: new Date(),
      },
    });
    if (ctx.item.conversationId) {
      await prisma.conversation
        .update({
          where: { id: ctx.item.conversationId },
          data: { lastMessageAt: ctx.item.createdAt },
        })
        .catch((error) =>
          captureError(error, { scope: "conversation_update" }),
        );
    }
  },
  async toast(ctx) {
    await prisma.inboxItem.update({
      where: { id: ctx.item.id },
      data: { status: "delivered", deliveredAt: new Date() },
    });
  },
  async email(ctx) {
    await prisma.inboxItem.update({
      where: { id: ctx.item.id },
      data: {
        status: "pending",
        nextAttemptAt: new Date(Date.now() + 5 * 60_000),
      },
    });
  },
  async push(ctx) {
    await prisma.inboxItem.update({
      where: { id: ctx.item.id },
      data: {
        status: "pending",
        nextAttemptAt: new Date(Date.now() + 60_000),
      },
    });
  },
  async log(ctx) {
    console.info("[inbox:log]", {
      itemId: ctx.item.id,
      tenantId: ctx.item.tenantId,
      key: ctx.payload.content.key,
      pii: ctx.item.piiClass,
      tags: ctx.item.classification,
    });
    await prisma.inboxItem.update({
      where: { id: ctx.item.id },
      data: { status: "delivered", deliveredAt: new Date() },
    });
  },
};

function getAdapter(channel: InboxChannel): InboxAdapter {
  return adapterMap[channel];
}

interface IngestOptions {
  actorAddress?: string;
  actorUserId?: string;
  bypassRateLimit?: boolean;
}

export async function ingestInboxPayload(
  rawPayload: unknown,
  options: IngestOptions = {},
) {
  const parsed = InboxPayloadSchema.parse(rawPayload);
  const payload: InboxPayloadInput & { tenantId: string } = {
    ...parsed,
    tenantId: normalizeTenant(parsed.tenantId),
  };

  const classification = classifyPayload(payload);

  if (!options.bypassRateLimit) {
    await ensureRateLimit(payload);
  }

  const thread = await resolveThreadId(payload);
  const dedupeKey = buildDedupeKey(payload, thread.id);

  const existing = dedupeKey
    ? await prisma.inboxItem.findUnique({ where: { dedupeKey } })
    : null;
  if (existing) {
    return { item: existing, thread, deduped: true } as const;
  }

  const encryptedPayload = wrapContent(payload.content);
  const encryptionActive = isEncryptionActive();
  const contentToPersist: InboxContent =
    encryptionActive && encryptedPayload !== payload.content
      ? summarizeContent(payload.content)
      : payload.content;

  const baseData: Prisma.InboxItemCreateInput = {
    tenantId: payload.tenantId,
    conversation: payload.conversationId
      ? { connect: { id: payload.conversationId } }
      : thread.conversationId
        ? { connect: { id: thread.conversationId } }
        : undefined,
    thread: { connect: { id: thread.id } },
    order: payload.orderId
      ? { connect: { id: payload.orderId } }
      : thread.orderId
        ? { connect: { id: thread.orderId } }
        : undefined,
    user: payload.userId ? { connect: { id: payload.userId } } : undefined,
    address: payload.address ?? null,
    type: payload.type as InboxType,
    importance: payload.importance as InboxImportance,
    channel: payload.channel as InboxChannel,
    lang: payload.lang,
    content: contentToPersist,
    encryptedContent:
      encryptedPayload === contentToPersist ? undefined : encryptedPayload,
    meta: sanitizeMeta(payload.meta ?? undefined) ?? undefined,
    classification: classification.tags,
    piiClass: classification.level,
    status: payload.status ?? InboxStatus.pending,
    dedupeKey,
    retryCount: 0,
    nextAttemptAt: payload.nextAttemptAt ?? null,
    expiresAt: payload.expiresAt ?? null,
  };

  const item = await prisma.inboxItem.create({ data: baseData });

  await writeAuditLog({
    actorAddress: options.actorAddress,
    actorUserId: options.actorUserId,
    action: "inbox_item_created",
    entityType: "inbox_item",
    entityId: item.id,
    tenantId: payload.tenantId,
    metadata: {
      channel: item.channel,
      importance: item.importance,
      threadId: thread.id,
      piiClass: item.piiClass,
      classification: classification.tags,
    },
  });

  const adapter = getAdapter(item.channel as InboxChannel);
  if (adapter) {
    await traceMessage(item.channel, "dispatch", () =>
      adapter({ item, payload }),
    );
  }

  if (
    shouldAutoDeliver(item.channel as InboxChannel) &&
    item.status !== InboxStatus.delivered
  ) {
    await prisma.inboxItem.update({
      where: { id: item.id },
      data: { status: "delivered", deliveredAt: new Date() },
    });
  }

  return {
    item: await prisma.inboxItem.findUniqueOrThrow({ where: { id: item.id } }),
    thread,
    deduped: false,
  };
}

export async function listThreadItems(params: {
  threadId?: string;
  conversationId?: string;
  limit?: number;
}) {
  const { threadId, conversationId, limit = 100 } = params;
  const items = await prisma.inboxItem.findMany({
    where: {
      threadId: threadId ?? undefined,
      conversationId: conversationId ?? undefined,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return items;
}

export async function markItemRead(itemId: string, address: string) {
  const updated = await prisma.inboxItem.update({
    where: { id: itemId },
    data: {
      readAt: new Date(),
      readBy: { push: address },
    },
  });
  return updated;
}
