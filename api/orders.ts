import { prisma } from "./_prisma";
import { N_PERCENT } from "./_config";

function ok(res: any, data: any, code = 200) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(code).json(data);
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    try {
      const {
        address = "",
        role = "any",
        status = "",
      } = (req.query || {}) as any;
      const where: any = {};
      if (status) where.status = status;
      if (address) {
        if (role === "maker") where.makerAddress = String(address);
        else if (role === "taker") where.takerAddress = String(address);
        else
          where.OR = [
            { makerAddress: String(address) },
            { takerAddress: String(address) },
          ];
      }
      const items = await prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
      return ok(res, { items });
    } catch (e: any) {
      console.error("/api/orders GET error:", e?.message || e);
      return ok(res, { items: [] }, 200);
    }
  }

  if (req.method === "POST") {
    try {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : req.body || {};
      const { title = "", makerAddress = "", priceTON, offerId = null } = body;
      const price = Number(priceTON);
      if (!title || !makerAddress || !Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ error: "invalid_payload" });
      }
      const makerDeposit = +(price * (1 + N_PERCENT / 100)).toFixed(9);
      const takerStake = +(price * 0.2).toFixed(9);
      // If creating a pre-chat thread for an offer, reuse existing 'created' order without taker
      if (offerId) {
        const existing = await prisma.order.findFirst({
          where: { offerId, status: "created" },
          orderBy: { createdAt: "desc" },
        });
        if (existing) return ok(res, existing, 200);
      }
      const created = await prisma.order.create({
        data: {
          title,
          makerAddress,
          priceTON: price,
          nPercent: N_PERCENT,
          makerDeposit,
          takerStake,
          offerId,
        },
      });
      return ok(res, created, 201);
    } catch (e: any) {
      return res.status(500).json({ error: "internal_error" });
    }
  }

  return res.status(405).json({ error: "method_not_allowed" });
}
