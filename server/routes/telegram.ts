import type { RequestHandler } from "express";
import { TELEGRAM_BOT_TOKEN, APP_BASE_URL } from "../config";

interface TgUser { id: number; }
interface TgMessage { message_id: number; text?: string; chat: { id: number }; from?: TgUser }
interface TgUpdate { update_id: number; message?: TgMessage }

async function tgSendMessage(chatId: number, text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("bot_token_missing");
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`telegram_send_failed_${r.status}`);
  return r.json().catch(() => null);
}

export const handleTelegramWebhook: RequestHandler = async (req, res) => {
  try {
    const update = req.body as TgUpdate;
    const msg = update?.message;
    if (!msg?.chat?.id) return res.status(200).json({ ok: true });

    const text = (msg.text || "").trim();
    const openUrl = APP_BASE_URL || (req.headers["x-forwarded-proto"] && req.headers["host"] ? `${req.headers["x-forwarded-proto"]}://${req.headers["host"]}` : "");

    if (text.startsWith("/start")) {
      const replyText = [
        "Welcome to FreeTON Freelance Exchange! 🎉",
        "I'm @freeltonrobot, your assistant for managing tasks and payments on the TON blockchain.",
        "Please connect your TON wallet to get started. Use the WebApp below to begin! 🚀",
      ].join("\n");

      const replyMarkup = openUrl
        ? { inline_keyboard: [[{ text: "Open FreeTON", web_app: { url: openUrl } }]] }
        : undefined;

      await tgSendMessage(msg.chat.id, replyText, replyMarkup);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("telegram webhook error:", e);
    // Never leak token or internals
    res.status(200).json({ ok: true });
  }
};
