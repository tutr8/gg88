import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { normalizeAddress } from "../lib/conversation-service";

export const postInboxRead: RequestHandler = async (req, res) => {
  try {
    const conversationId = String(req.body?.conversationId || "");
    const address = normalizeAddress(String(req.body?.address || ""));
    if (!conversationId || !address) {
      return res.status(400).json({ error: "bad_request" });
    }

    const unread = await prisma.inboxItem.findMany({
      where: {
        conversationId,
        NOT: { readBy: { has: address } },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: 2000,
    });

    for (const it of unread) {
      await prisma.inboxItem.update({
        where: { id: it.id },
        data: { readAt: new Date(), readBy: { push: address } },
      });
    }

    try {
      const { notifyRead } = await import("../lib/sse");
      await notifyRead({ conversationId, by: address });
    } catch {}

    return res.status(200).json({ ok: true, count: unread.length });
  } catch (e) {
    return res.status(500).json({ error: "internal_error" });
  }
};
