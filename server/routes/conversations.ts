import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import {
  ensureFavoritesConversation,
  ensureParticipantAccess,
  getConversationByIdentifier,
  normalizeAddress,
} from "../lib/conversation-service";
import { unwrapContent } from "../lib/encryption";
import { getMetricsSnapshot } from "../lib/observability";

function mapMessage(item: any, address: string) {
  const rawContent = item.encryptedContent ?? item.content ?? {};
  const payload = unwrapContent(rawContent as any);
  const text =
    typeof payload === "string"
      ? payload
      : typeof (payload as any)?.args?.text === "string"
        ? (payload as any).args.text
        : ((payload as any)?.text ?? "");
  return {
    id: item.id,
    createdAt: item.createdAt,
    type: item.type,
    importance: item.importance,
    channel: item.channel,
    text,
    lang: item.lang,
    address: item.address,
    meta: item.meta ?? {},
    unread: !item.readBy.includes(address),
  };
}

export const listConversations: RequestHandler = async (req, res) => {
  try {
    const addressRaw = String(req.query.address || "");
    const address = normalizeAddress(addressRaw);
    if (!address) return res.status(400).json({ error: "address_required" });

    const participantRecords = await prisma.conversationParticipant.findMany({
      where: { address },
      select: { conversationId: true },
    });
    const conversationIds = participantRecords.map((p) => p.conversationId);

    if (!conversationIds.length) {
      await ensureFavoritesConversation(address);
      return res.json({ conversations: [], metrics: getMetricsSnapshot() });
    }

    const conversations = await prisma.conversation.findMany({
      where: { id: { in: conversationIds } },
      include: {
        order: true,
        participants: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const results = [] as any[];
    for (const convo of conversations) {
      const lastMessage = await prisma.inboxItem.findFirst({
        where: { conversationId: convo.id },
        orderBy: { createdAt: "desc" },
      });
      const unreadCount = await prisma.inboxItem.count({
        where: {
          conversationId: convo.id,
          readBy: { has: address },
        },
      });
      const unreadTotal = (await prisma.inboxItem.count({
        where: {
          conversationId: convo.id,
          NOT: {
            readBy: { has: address },
          },
        },
      })) as number;
      results.push({
        id: convo.id,
        kind: convo.kind,
        orderId: convo.orderId,
        title:
          convo.kind === "favorites"
            ? "Favorites"
            : (convo.order?.title ?? "Order Chat"),
        updatedAt: convo.updatedAt,
        lastMessage: lastMessage ? mapMessage(lastMessage, address) : null,
        unreadCount: unreadTotal,
        participants: convo.participants.map((p) => ({
          address: p.address,
          role: p.role,
        })),
        metadata: convo.metadata ?? {},
        totalMessages: await prisma.inboxItem.count({
          where: { conversationId: convo.id },
        }),
        readCount: unreadCount,
      });
    }

    return res.json({ conversations: results, metrics: getMetricsSnapshot() });
  } catch (e) {
    console.error("listConversations error:", e);
    return res.status(500).json({ error: "internal_error" });
  }
};

export const getConversation: RequestHandler = async (req, res) => {
  try {
    const { id = "" } = req.params as any;
    const addressRaw = String(req.query.address || "");
    const address = normalizeAddress(addressRaw);
    if (!address || !id) return res.status(400).json({ error: "bad_request" });

    const conversation = await getConversationByIdentifier({
      conversationId: id,
    });
    if (!conversation) return res.status(404).json({ error: "not_found" });

    try {
      await ensureParticipantAccess(conversation.id, address);
    } catch (err: any) {
      const status = (err && (err as any).statusCode) || 500;
      if (status === 403) return res.status(403).json({ error: "forbidden" });
      throw err;
    }

    const items = await prisma.inboxItem.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });

    return res.json({
      conversation,
      messages: items.map((item) => mapMessage(item, address)),
    });
  } catch (e) {
    console.error("getConversation error:", e);
    return res.status(500).json({ error: "internal_error" });
  }
};
