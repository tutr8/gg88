import { prisma } from "../shared/prisma";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      let q = "";
      // Prefer framework-provided query first
      if (req?.query && typeof (req.query as any).q === "string") {
        q = String((req.query as any).q || "").trim();
      } else {
        try {
          const base = `${req.headers?.["x-forwarded-proto"] || "https"}://${req.headers?.host || "localhost"}`;
          const raw = (req as any).originalUrl || req.url || base;
          const url = new URL(raw, base);
          q = String(url.searchParams.get("q") || "").trim();
        } catch {}
      }
      const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
      const where = tokens.length
        ? {
            AND: tokens.map((t) => ({
              OR: [
                { title: { contains: t, mode: "insensitive" as const } },
                { description: { contains: t, mode: "insensitive" as const } },
              ],
            })),
          }
        : undefined;
      const items = await prisma.offer.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          budgetTON: true,
          status: true,
          createdAt: true,
          creator: { select: { address: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      const mapped = items.map((o) => ({
        ...o,
        makerAddress: o.creator?.address || null,
      }));
      return res.status(200).json({ items: mapped });
    }

    if (req.method === "POST") {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : req.body || {};
      const { title, description = "", budgetTON, makerAddress = "" } = body;
      if (!title || typeof budgetTON !== "number" || budgetTON < 0) {
        return res.status(400).json({ error: "Invalid payload" });
      }
      let creatorId: string | undefined;
      if (makerAddress) {
        const user = await prisma.user.findUnique({
          where: { address: makerAddress },
        });
        if (user) creatorId = user.id;
      }
      const created = await prisma.offer.create({
        data: {
          title,
          description,
          budgetTON,
          status: "open",
          ...(creatorId ? { creatorId } : {}),
        },
      });
      return res.status(201).json(created);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("/api/offers error:", e?.message || e);
    // Be resilient: don't break homepage if DB is unreachable; return empty list
    return res.status(200).json({ items: [] });
  }
}
