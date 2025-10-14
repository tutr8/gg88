import prisma from "./prisma";

function allowCORS(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeAddress(address: string) {
  return String(address || "").trim().toLowerCase();
}

async function ensureFavoritesConversation(address: string) {
  const user = await prisma.user.upsert({
    where: { address },
    update: {},
    create: { address, nickname: address },
  });
  let conversation = await prisma.conversation.findFirst({
    where: { kind: "favorites", ownerId: user.id },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        kind: "favorites",
        ownerId: user.id,
        participants: {
          create: { address, role: "owner", userId: user.id },
        },
      },
    });
  } else {
    await prisma.conversationParticipant.upsert({
      where: {
        conversationId_address: { conversationId: conversation.id, address },
      },
      update: { role: "owner", userId: user.id },
      create: {
        conversationId: conversation.id,
        address,
        role: "owner",
        userId: user.id,
      },
    });
  }
  return conversation;
}

export default async function handler(req: any, res: any) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const raw = String((req.query?.address as string) || "");
    const address = normalizeAddress(raw);
    if (!address) return res.status(400).json({ error: "address_required" });

    const participantRecords = await prisma.conversationParticipant.findMany({
      where: { address },
      select: { conversationId: true },
    });
    const conversationIds = participantRecords.map((p) => p.conversationId);

    if (!conversationIds.length) {
      await ensureFavoritesConversation(address);
      return res.json({ conversations: [] });
    }

    const conversations = await prisma.conversation.findMany({
      where: { id: { in: conversationIds } },
      include: { order: true, participants: true },
      orderBy: { updatedAt: "desc" },
    });

    const results: any[] = [];
    for (const convo of conversations) {
      const lastMessage = await prisma.inboxItem.findFirst({
        where: { conversationId: convo.id },
        orderBy: { createdAt: "desc" },
      });
      const unreadTotal = await prisma.inboxItem.count({
        where: { conversationId: convo.id, NOT: { readBy: { has: address } } },
      });
      results.push({
        id: convo.id,
        kind: convo.kind,
        orderId: convo.orderId,
        updatedAt: convo.updatedAt,
        lastMessage: lastMessage
          ? { text: (lastMessage as any).content?.args?.text || "", createdAt: lastMessage.createdAt }
          : null,
        unreadCount: unreadTotal,
        participants: convo.participants.map((p) => ({ address: p.address, role: p.role })),
        metadata: convo.metadata ?? {},
      });
    }

    return res.json({ conversations: results });
  } catch (e) {
    console.error("/api/conversations error:", e);
    return res.status(500).json({ error: "internal_error" });
  }
}
