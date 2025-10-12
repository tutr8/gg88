import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { ingestInboxPayload, listThreadItems } from "../lib/inbox-service";
import { unwrapContent } from "../lib/encryption";
import { ensureOrderConversation } from "../lib/conversation-service";
import { captureError } from "../lib/observability";

function mapChatItem(item: any) {
  const payload = unwrapContent(item.encryptedContent ?? item.content ?? {});
  return {
    id: item.id,
    orderId: item.orderId,
    sender: item.address,
    text:
      typeof payload === "string"
        ? payload
        : typeof (payload as any)?.args?.text === "string"
        ? (payload as any).args.text
        : (payload as any)?.text ?? "",
    createdAt: item.createdAt,
  };
}

export const listMessages: RequestHandler = async (req, res) => {
  try {
    const orderId = String((req.query as any)?.orderId || "").trim();
    if (!orderId) return res.status(400).json({ error: "orderId_required" });

    const conversation = await prisma.conversation.findFirst({
      where: { orderId },
    });
    if (!conversation) {
      return res.json({ items: [] });
    }

    const items = await listThreadItems({ conversationId: conversation.id });
    const chats = items.filter((item) => item.channel === "chat");
    return res.status(200).json({ items: chats.map(mapChatItem) });
  } catch (error) {
    captureError(error, { scope: "listMessages" });
    return res.status(500).json({ error: "internal_error" });
  }
};

export const createMessage: RequestHandler = async (req, res) => {
  try {
    const { orderId = "", sender = "", text = "", lang = "en" } =
      (req.body ?? {}) as Record<string, unknown>;
    if (!orderId || !sender || !text) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const order = await prisma.order.findUnique({
      where: { id: String(orderId) },
      select: { makerAddress: true, takerAddress: true },
    });
    if (!order) {
      return res.status(404).json({ error: "order_not_found" });
    }

    const conversation = await ensureOrderConversation(
      String(orderId),
      order.makerAddress,
      order.takerAddress,
    );

    const result = await ingestInboxPayload(
      {
        conversationId: conversation.id,
        orderId: String(orderId),
        address: String(sender).toLowerCase(),
        channel: "chat",
        type: "message",
        importance: "normal",
        lang: String(lang || "en"),
        content: { key: "chat.message", args: { text: String(text) } },
        meta: {
          traceId:
            typeof req.headers["x-trace-id"] === "string"
              ? req.headers["x-trace-id"]
              : undefined,
          source: "chat_api",
        },
        piiClass: "personal",
      },
      { actorAddress: String(sender) },
    );

    const item = mapChatItem(result.item);
    return res.status(result.deduped ? 200 : 201).json(item);
  } catch (error) {
    captureError(error, { scope: "createMessage" });
    const statusCode = (error as any)?.statusCode ?? 500;
    res.status(statusCode).json({ error: (error as any)?.message ?? "internal_error" });
  }
};
