import { prisma } from "../_prisma";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-secret");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const provided = String(
    req.headers["x-admin-secret"] || req.query?.secret || "",
  );
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  if (!ADMIN_SECRET || provided !== ADMIN_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    await prisma.$transaction([
      prisma.review.deleteMany({}),
      prisma.job.deleteMany({}),
      prisma.offer.deleteMany({}),
      prisma.user.deleteMany({}),
    ]);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
