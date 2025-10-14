import { prisma } from "../prisma";
import { ADMIN_WHITELIST } from "../_config";

function allowCORS(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: any, res: any) {
  allowCORS(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const id = String(req.query?.id || "");
  if (!id) return res.status(400).json({ error: "id_required" });

  if (req.method === "GET") {
    try {
      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) return res.status(404).json({ error: "not_found" });
      return res.status(200).json({ order });
    } catch (e) {
      return res.status(500).json({ error: "internal_error" });
    }
  }

  if (req.method === "PATCH") {
    try {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : req.body || {};
      const action = String(body.action || "");
      const actor = String(body.actor || "");

      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) return res.status(404).json({ error: "not_found" });

      if (action === "take") {
        const takerAddress = String(body.takerAddress || "");
        if (!takerAddress)
          return res.status(400).json({ error: "taker_required" });
        if (order.status !== "created")
          return res.status(409).json({ error: "bad_state" });
        const updated = await prisma.order.update({
          where: { id },
          data: { status: "in_progress", takerAddress },
        });
        return res.status(200).json({ order: updated });
      }

      if (action === "confirm") {
        if (!actor) return res.status(400).json({ error: "actor_required" });
        const data: any = {};
        if (actor === "maker") data.makerConfirmed = true;
        else if (actor === "taker") data.takerConfirmed = true;
        else return res.status(400).json({ error: "bad_actor" });
        let updated = await prisma.order.update({ where: { id }, data });
        if (
          updated.makerConfirmed &&
          updated.takerConfirmed &&
          updated.status !== "completed"
        ) {
          updated = await prisma.order.update({
            where: { id },
            data: { status: "completed", completedAt: new Date() },
          });
        }
        return res.status(200).json({ order: updated });
      }

      if (action === "cancel") {
        const by = String(body.by || "");
        const isAdmin = ADMIN_WHITELIST.includes(by);
        if (order.status === "completed")
          return res.status(409).json({ error: "already_completed" });
        if (!isAdmin && order.status === "in_progress") {
          return res.status(403).json({ error: "forbidden" });
        }
        const updated = await prisma.order.update({
          where: { id },
          data: { status: "cancelled", cancelledAt: new Date() },
        });
        return res.status(200).json({ order: updated });
      }

      return res.status(400).json({ error: "bad_action" });
    } catch (e) {
      return res.status(500).json({ error: "internal_error" });
    }
  }

  return res.status(405).json({ error: "method_not_allowed" });
}
