import type { RequestHandler } from "express";
import { subscribe } from "../lib/sse";
import { normalizeAddress } from "../lib/conversation-service";

export const stream: RequestHandler = (req, res) => {
  const address = normalizeAddress(String(req.query.address || ""));
  if (!address) return res.status(400).json({ error: "address_required" });
  // CORS headers are applied globally via middleware
  subscribe(address, res);
};
