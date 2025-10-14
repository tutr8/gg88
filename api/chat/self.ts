import prisma from "../prisma";

function allowCORS(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeAddress(address: string) {
  return String(address || "").trim().toLowerCase();
}

export default async function handler(req: any, res: any) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const addressRaw =
      (req.body?.address as string | undefined) ||
      (req.query?.address as string | undefined) ||
      "";
    const address = normalizeAddress(addressRaw);
    if (!address) return res.status(400).json({ error: "address_required" });

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
          conversationId_address: {
            conversationId: conversation.id,
            address,
          },
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

    return res.json({ ok: true, conversation });
  } catch (e) {
    console.error("/api/chat/self error:", e);
    return res.status(500).json({ error: "internal_error" });
  }
}
