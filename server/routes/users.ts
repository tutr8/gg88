import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";

// MVP: nickname is always equal to address. Remove manual nickname handling.
export const upsertUser: RequestHandler = async (req, res) => {
  let address = String(req.body?.address || "").trim();
  try {
    const { Address } = await import("@ton/core");
    const parsed = Address.parse(address);
    address = parsed.toString({ urlSafe: true, bounceable: true });
  } catch {}
  if (!address) return res.status(400).json({ error: "address required" });
  try {
    const user = await prisma.user.upsert({
      where: { address },
      update: { nickname: address },
      create: { address, nickname: address },
    });
    res.json({ ok: true, user });
  } catch (e: any) {
    console.error("users route error:", e);
    res.status(500).json({ error: "internal_error" });
  }
};

export const getUserByAddress: RequestHandler = async (req, res) => {
  const address = String(req.params.address || "").trim();
  if (!address) return res.status(400).json({ error: "address required" });
  try {
    const user = await prisma.user.findUnique({ where: { address } });
    if (!user) return res.status(404).json({ error: "user not found" });
    // Ensure nickname reflects MVP rule on read as well
    const normalized = { ...user, nickname: user.nickname || user.address };
    res.json({ ok: true, user: normalized });
  } catch (e: any) {
    console.error("users route error:", e);
    res.status(500).json({ error: "internal_error" });
  }
};
