import { prisma } from "../_prisma";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const id = String(req.query?.id || "").trim();
    if (!id) return res.status(400).json({ error: "id required" });
    const offer = await prisma.offer.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        budgetTON: true,
        status: true,
        createdAt: true,
        creator: { select: { address: true } },
      },
    });
    if (!offer) return res.status(404).json({ error: "not found" });
    const mapped = { ...offer, makerAddress: offer.creator?.address || null };
    return res.status(200).json({ offer: mapped });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
