import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { ADMIN_SECRET } from "../config";
import { ensureOrderConversation } from "../lib/conversation-service";

const N_PERCENT = 1; // Default commission percent used in calculations

export const listOrders: RequestHandler = async (req, res) => {
  try {
    const address = String((req.query as any)?.address || "");
    const role = String((req.query as any)?.role || "any");
    const status = String((req.query as any)?.status || "");
    const where: any = {};
    if (status) where.status = status;
    if (address) {
      if (role === "maker") where.makerAddress = address;
      else if (role === "taker") where.takerAddress = address;
      else where.OR = [{ makerAddress: address }, { takerAddress: address }];
    }
    const items = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json({ items });
  } catch (e) {
    console.error("listOrders error:", e);
    return res.status(200).json({ items: [] });
  }
};

export const createOrder: RequestHandler = async (req, res) => {
  try {
    const {
      title = "",
      makerAddress: makerRaw = "",
      priceTON,
      offerId = null,
      takerAddress: takerRaw = "",
      deadline: deadlineRaw = null,
    } = req.body ?? {};
    const price = Number(priceTON);

    let makerAddress = String(makerRaw || "").trim();
    if (!makerAddress && offerId) {
      const offer = await prisma.offer.findUnique({
        where: { id: String(offerId) },
        select: { creator: { select: { address: true } } },
      });
      makerAddress = offer?.creator?.address || "";
    }

    const takerAddress = String(takerRaw || "").trim();

    if (!title || !Number.isFinite(price) || price <= 0 || !makerAddress) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    const makerDeposit = +(price * (1 + N_PERCENT / 100)).toFixed(9);
    const takerStake = +(price * 0.2).toFixed(9);

    const takerForRecord = takerAddress ? takerAddress : null;

    if (offerId) {
      const existing = await prisma.order.findFirst({
        where: { offerId, status: "created" },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        if (
          takerForRecord &&
          existing.takerAddress &&
          existing.takerAddress !== takerForRecord
        ) {
          return res.status(409).json({ error: "order_taken" });
        }

        let order = existing;
        if (takerForRecord && !existing.takerAddress) {
          order = await prisma.order.update({
            where: { id: existing.id },
            data: { takerAddress: takerForRecord },
          });
        }

        const conversation = await ensureOrderConversation(
          order.id,
          order.makerAddress,
          takerForRecord ?? order.takerAddress ?? undefined,
        );

        // For existing order, allow updating deadline as well
        let updatedConversation = conversation;
        const deadlineExisting = (req.body ?? {}).deadline;
        if (deadlineExisting) {
          const d = new Date(String(deadlineExisting));
          if (!isNaN(d.getTime())) {
            try {
              updatedConversation = await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                  metadata: {
                    ...(conversation as any).metadata,
                    deadlineISO: d.toISOString(),
                  },
                },
              });
            } catch (e) {
              console.warn(
                "failed to set deadline on existing conversation",
                e,
              );
            }
          }
        }

        return res.status(200).json({
          ...order,
          conversationId: updatedConversation.id,
          conversation: updatedConversation,
        });
      }
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
        takerAddress: takerForRecord,
      },
    });

    const conversation = await ensureOrderConversation(
      created.id,
      created.makerAddress,
      takerForRecord ?? created.takerAddress ?? undefined,
    );

    // Optional deadline saved into conversation metadata (no schema changes required)
    let updatedConversation = conversation;
    if (deadlineRaw) {
      const d = new Date(String(deadlineRaw));
      if (!isNaN(d.getTime())) {
        try {
          updatedConversation = await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              metadata: {
                ...(conversation as any).metadata,
                deadlineISO: d.toISOString(),
              },
            },
          });
        } catch (e) {
          console.warn("failed to set deadline on conversation", e);
        }
      }
    }

    res.status(201).json({
      ...created,
      conversationId: updatedConversation.id,
      conversation: updatedConversation,
    });
  } catch (e) {
    console.error("createOrder error:", e);
    res.status(500).json({ error: "internal_error" });
  }
};

export const getOrderById: RequestHandler = async (req, res) => {
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "id_required" });
  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "not_found" });
    res.json({ order });
  } catch (e) {
    console.error("getOrderById error:", e);
    res.status(500).json({ error: "internal_error" });
  }
};

export const updateOrder: RequestHandler = async (req, res) => {
  const id = String(req.params.id || "");
  if (!id) return res.status(400).json({ error: "id_required" });
  try {
    const action = String(req.body?.action || "");
    const actor = String(req.body?.actor || "");

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: "not_found" });

    if (action === "take") {
      const takerAddress = String(req.body?.takerAddress || "");
      if (!takerAddress)
        return res.status(400).json({ error: "taker_required" });
      if (order.status !== "created")
        return res.status(409).json({ error: "bad_state" });
      const updated = await prisma.order.update({
        where: { id },
        data: { status: "in_progress", takerAddress },
      });
      return res.json({ order: updated });
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
      return res.json({ order: updated });
    }

    if (action === "cancel") {
      const by = String(req.body?.by || "");
      const isAdmin = Boolean(ADMIN_SECRET) && by === ADMIN_SECRET; // simple admin check via secret
      if (order.status === "completed")
        return res.status(409).json({ error: "already_completed" });
      if (!isAdmin && order.status === "in_progress")
        return res.status(403).json({ error: "forbidden" });
      const updated = await prisma.order.update({
        where: { id },
        data: { status: "cancelled", cancelledAt: new Date() },
      });
      return res.json({ order: updated });
    }

    return res.status(400).json({ error: "bad_action" });
  } catch (e) {
    console.error("updateOrder error:", e);
    res.status(500).json({ error: "internal_error" });
  }
};
