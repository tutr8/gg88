import type { RequestHandler } from "express";
import { normalizeAddress } from "../lib/conversation-service";

export const postTyping: RequestHandler = async (req, res) => {
  try {
    const address = normalizeAddress(String(req.body?.address || ""));
    const conversationId = String(req.body?.conversationId || "");
    const typing = Boolean(req.body?.typing);
    if (!address || !conversationId) {
      return res.status(400).json({ error: "bad_request" });
    }
    try {
      const { notifyTyping } = await import("../lib/sse");
      await notifyTyping({ conversationId, from: address, typing });
    } catch {}
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "internal_error" });
  }
};
