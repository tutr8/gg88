import type { RequestHandler } from "express";
import { ingestInboxPayload, listThreadItems } from "../lib/inbox-service";
import { unwrapContent } from "../lib/encryption";
import { captureError } from "../lib/observability";

function mapItem(item: any) {
  const content = unwrapContent(item.encryptedContent ?? item.content ?? {});
  return {
    id: item.id,
    tenantId: item.tenantId,
    threadId: item.threadId,
    conversationId: item.conversationId,
    orderId: item.orderId,
    userId: item.userId,
    address: item.address,
    type: item.type,
    importance: item.importance,
    channel: item.channel,
    lang: item.lang,
    content,
    meta: item.meta ?? {},
    piiClass: item.piiClass,
    status: item.status,
    dedupeKey: item.dedupeKey,
    retryCount: item.retryCount,
    nextAttemptAt: item.nextAttemptAt,
    deliveredAt: item.deliveredAt,
    readAt: item.readAt,
    readBy: item.readBy,
    expiresAt: item.expiresAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export const postInboxItem: RequestHandler = async (req, res) => {
  try {
    const result = await ingestInboxPayload(req.body, {
      actorAddress: req.body?.address,
      actorUserId: req.body?.userId,
    });
    const status = result.deduped ? 200 : 201;
    res.status(status).json({
      item: mapItem(result.item),
      thread: result.thread,
      deduped: result.deduped,
    });
  } catch (error) {
    captureError(error, { scope: "postInboxItem" });
    const statusCode = (error as any)?.statusCode ?? 500;
    const retryAfter = (error as any)?.retryAfter;
    if (retryAfter) {
      res.setHeader("Retry-After", Math.ceil(retryAfter / 1000));
    }
    res.status(statusCode).json({
      error: (error as any)?.message ?? "internal_error",
    });
  }
};

export const listInboxByThread: RequestHandler = async (req, res) => {
  try {
    const threadId = req.query.threadId ? String(req.query.threadId) : undefined;
    const conversationId = req.query.conversationId
      ? String(req.query.conversationId)
      : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    if (!threadId && !conversationId) {
      return res.status(400).json({ error: "thread_or_conversation_required" });
    }
    const items = await listThreadItems({ threadId, conversationId, limit });
    res.json({ items: items.map(mapItem) });
  } catch (error) {
    captureError(error, { scope: "listInboxByThread" });
    res.status(500).json({ error: "internal_error" });
  }
};
