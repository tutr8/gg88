import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  createOffer,
  listOffers,
  tonChainInfo,
  getOfferById,
} from "./routes/offers";
import { getUserByAddress, upsertUser } from "./routes/users";
import {
  listOrders,
  createOrder,
  getOrderById,
  updateOrder,
} from "./routes/orders";
import { listMessages, createMessage } from "./routes/messages";
import { listInboxByThread, postInboxItem } from "./routes/inbox";
import { getConversation, listConversations } from "./routes/conversations";

import { PING_MESSAGE, TON_API_BASE, CORS_ORIGIN } from "./config";
import { resetDatabase } from "./routes/admin";
import { handleTelegramWebhook } from "./routes/telegram";
import { ensureSelfChat } from "./routes/chat";

export function createServer() {
  const app = express();

  // Middleware
  const origins = (CORS_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const corsOptions = origins.length ? { origin: origins } : { origin: true };
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    res.json({ message: PING_MESSAGE });
  });

  app.get("/api/demo", handleDemo);

  // Users API
  app.post("/api/users/upsert", upsertUser);
  app.get("/api/users/:address", getUserByAddress);

  // Offers API
  app.get("/api/offers", listOffers);
  app.get("/api/offers/:id", getOfferById);
  app.post("/api/offers", createOffer);

  // Orders API
  app.get("/api/orders", listOrders);
  app.post("/api/orders", createOrder);
  app.get("/api/orders/:id", getOrderById);
  app.patch("/api/orders/:id", updateOrder);

  // Messages API (legacy chat compatibility)
  app.get("/api/messages", listMessages);
  app.post("/api/messages", createMessage);

  // Inbox API
  app.get("/api/inbox", listInboxByThread);
  app.post("/api/inbox", postInboxItem);

  // Conversation API
  app.get("/api/conversations", listConversations);
  app.get("/api/conversations/:id", getConversation);

  // Chat helpers
  app.post("/api/chat/self", ensureSelfChat);

  // TON chain info proxy
  app.get("/api/ton/info", tonChainInfo);

  // Telegram bot webhook
  app.post("/api/telegram/webhook", handleTelegramWebhook);

  // Admin
  app.post("/api/admin/reset", resetDatabase);

  // Serve TonConnect manifest with CORS to satisfy wallets
  app.get("/tonconnect-manifest.json", async (req, res) => {
    try {
      const base = `${req.protocol}://${req.get("host")}`;
      const origin = base.replace(/\/$/, "");
      const tonServer = (TON_API_BASE || "").replace(/\/$/, "");

      const manifest = {
        manifestVersion: "1.1",
        url: base,
        name: "FreelTON",
        iconUrl: `${base}/placeholder.svg`,
        termsOfUseUrl: `${base}/terms`,
        privacyPolicyUrl: `${base}/privacy`,
        ton: {
          default: {
            name: "TON",
            description: "TON blockchain",
            servers: [{ name: "tonapi", url: tonServer }],
          },
        },
      };
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json(manifest);
    } catch (e) {
      res.status(500).json({ error: "manifest build error" });
    }
  });

  // Serve placeholder icon with CORS
  app.get("/placeholder.svg", async (_req, res) => {
    try {
      const path = await import("path");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.sendFile(path.resolve(process.cwd(), "public/placeholder.svg"));
    } catch (e) {
      res.status(404).end();
    }
  });

  // Generic error handler (avoid leaking internals)
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
