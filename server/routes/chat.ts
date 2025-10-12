import type { RequestHandler } from "express";
import {
  ensureFavoritesConversation,
  normalizeAddress,
} from "../lib/conversation-service";
import { writeAuditLog } from "../lib/audit";

export const ensureSelfChat: RequestHandler = async (req, res) => {
  try {
    const addressRaw =
      (req.body?.address as string | undefined) ||
      (req.query?.address as string | undefined) ||
      "";
    const address = normalizeAddress(addressRaw);
    if (!address) return res.status(400).json({ error: "address_required" });

    const { conversation, user } = await ensureFavoritesConversation(address);
    await writeAuditLog({
      actorAddress: address,
      actorUserId: user.id,
      action: "ensure_favorites_conversation",
      entityType: "conversation",
      entityId: conversation.id,
      metadata: { kind: conversation.kind },
    });

    return res.json({ ok: true, conversation });
  } catch (e) {
    console.error("ensureSelfChat error:", e);
    return res.status(500).json({ error: "internal_error" });
  }
};
