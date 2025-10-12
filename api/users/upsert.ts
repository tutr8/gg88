import { prisma } from "../_prisma";
import { Address } from "@ton/core";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};
    let address = String(body.address || "").trim();
    try {
      const parsed = Address.parse(address);
      address = parsed.toString({ urlSafe: true, bounceable: true });
    } catch {}
    if (!address) return res.status(400).json({ error: "address required" });

    const user = await prisma.user.upsert({
      where: { address },
      update: { nickname: address },
      create: { address, nickname: address },
    });

    return res.status(200).json({ ok: true, user });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
