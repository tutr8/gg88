import { prisma } from "./_prisma";

function allow(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: any, res: any) {
  allow(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    try {
      const orderId = String((req.query as any)?.orderId || "");
      if (!orderId) return res.status(400).json({ error: "orderId_required" });
      const items = await prisma.message.findMany({
        where: { orderId },
        orderBy: { createdAt: "asc" },
      });
      return res.status(200).json({ items });
    } catch (e) {
      return res.status(500).json({ error: "internal_error" });
    }
  }

  if (req.method === "POST") {
    try {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : req.body || {};
      const { orderId = "", sender = "", text = "" } = body;
      if (!orderId || !sender || !text)
        return res.status(400).json({ error: "invalid_payload" });
      const created = await prisma.message.create({
        data: { orderId, sender, text },
      });
      return res.status(201).json(created);
    } catch (e) {
      return res.status(500).json({ error: "internal_error" });
    }
  }

  return res.status(405).json({ error: "method_not_allowed" });
}
