import prisma from "../prisma";

function allowCORS(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeAddress(address: string) {
  return String(address || "").trim().toLowerCase();
}

async function ensureParticipantAccess(conversationId: string, address: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_address: { conversationId, address } },
  });
  if (!participant) {
    const err: any = new Error("forbidden");
    err.statusCode = 403;
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const id = String(req.query?.id || "");
    const raw = String((req.query?.address as string) || "");
    const address = normalizeAddress(raw);
    if (!address || !id) return res.status(400).json({ error: "bad_request" });

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) return res.status(404).json({ error: "not_found" });

    try {
      await ensureParticipantAccess(conversation.id, address);
    } catch (e: any) {
      if (e?.statusCode === 403) return res.status(403).json({ error: "forbidden" });
      throw e;
    }

    const items = await prisma.inboxItem.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });

    const messages = items.map((item: any) => {
      const payload = item.encryptedContent ?? item.content ?? {};
      const text = (payload as any)?.args?.text || (payload as any)?.text || "";
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
        unread: !(item.readBy || []).includes(address),
      };
    });

    return res.json({ conversation, messages });
  } catch (e) {
    console.error("/api/conversations/[id] error:", e);
    return res.status(500).json({ error: "internal_error" });
  }
}
