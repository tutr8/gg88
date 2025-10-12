import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { TON_API_BASE, TON_API_KEY } from "../config";

export const getOfferById: RequestHandler = async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    const offerRaw = await prisma.offer.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        budgetTON: true,
        status: true,
        createdAt: true,

        creator: { select: { address: true } },

        makerAddress: true,
      },
    });
    if (!offerRaw) return res.status(404).json({ error: "not_found" });
    const offer = {
      id: offerRaw.id,
      title: offerRaw.title,
      description: offerRaw.description,
      budgetTON: offerRaw.budgetTON,
      status: offerRaw.status,
      createdAt: offerRaw.createdAt,
      makerAddress: offerRaw.creator?.address || "",
    };
    res.json({ offer });
  } catch (e: any) {
    console.error("getOfferById error:", e);
    res.status(500).json({ error: "internal_error" });
  }
};

export const listOffers: RequestHandler = async (req, res) => {
  try {
    const qRaw = String((req.query?.q as string) || "").trim();
    const stackRaw = String((req.query?.stack as string) || "").trim();

    const minBudgetStr = String((req.query?.minBudget as string) ?? "").trim();
    const maxBudgetStr = String((req.query?.maxBudget as string) ?? "").trim();

    const minBudget = minBudgetStr !== "" ? Number(minBudgetStr) : null;
    const maxBudget = maxBudgetStr !== "" ? Number(maxBudgetStr) : null;

    const tokens = [
      ...(qRaw ? qRaw.split(/\s+/).filter(Boolean) : []),
      ...(stackRaw ? stackRaw.split(/[\,\s]+/).filter(Boolean) : []),
    ];

    const filters: any[] = [];

    if (tokens.length) {
      filters.push(
        ...tokens.map((t) => ({
          OR: [
            { title: { contains: t, mode: "insensitive" as const } },
            { description: { contains: t, mode: "insensitive" as const } },
          ],
        })),
      );
    }

    if (minBudget !== null && Number.isFinite(minBudget)) {
      filters.push({ budgetTON: { gte: minBudget } });
    }
    if (maxBudget !== null && Number.isFinite(maxBudget)) {
      filters.push({ budgetTON: { lte: maxBudget } });
    }

    const where = filters.length ? { AND: filters } : undefined;

    const items = await prisma.offer.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        budgetTON: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  } catch (e: any) {
    console.error("listOffers error:", e);
    return res.status(200).json({ items: [] });
  }
};

export const createOffer: RequestHandler = async (req, res) => {
  const {
    title,
    description = "",
    budgetTON,
    stack = "",
    makerAddress = "",
  } = req.body ?? {};
  if (!title || typeof budgetTON !== "number" || budgetTON < 0) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  try {
    const desc = stack
      ? `${description}\n\nStack: ${String(stack)}`
      : description;
    let creatorId: string | undefined = undefined;
    const addr = String(makerAddress || "").trim();
    if (addr) {
      // Ensure user exists and link as creator
      const user = await prisma.user.upsert({
        where: { address: addr },
        update: { nickname: addr },
        create: { address: addr, nickname: addr },
      });
      creatorId = user.id;
    }
    const created = await prisma.offer.create({
      data: { title, description: desc, budgetTON, status: "open", creatorId },
      select: {
        id: true,
        title: true,
        description: true,
        budgetTON: true,
        status: true,
        createdAt: true,
      },
    });
    res.status(201).json(created);
  } catch (e: any) {
    console.error("createOffer error:", e);
    res.status(500).json({ error: "internal_error" });
  }
};

export const tonChainInfo: RequestHandler = async (_req, res) => {
  try {
    const origin = TON_API_BASE.replace(/\/$/, "");
    const candidates = [
      `${origin}/v2/blockchain/info`,
      `${origin}/v2/blockchain/config`,
    ];

    const headers: Record<string, string> = { Accept: "application/json" };
    if (TON_API_KEY) {
      headers["Authorization"] = `Bearer ${TON_API_KEY}`;
      headers["X-API-Key"] = TON_API_KEY;
    }

    for (const url of candidates) {
      try {
        const r = await fetch(url, { headers });
        const contentType = r.headers.get("content-type") || "";
        const isJson = contentType.includes("application/json");
        if (!r.ok) continue;
        const data = isJson ? await r.json() : await r.text();
        return res.json({ ok: true, data, url });
      } catch (_) {
        // try next
      }
    }

    return res
      .status(502)
      .json({ ok: false, error: "upstream_unavailable", candidates });
  } catch (e) {
    console.error("tonChainInfo error:", e);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
};
