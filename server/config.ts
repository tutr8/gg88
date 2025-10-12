export const DATABASE_URL = process.env.DATABASE_URL || "";
export const TON_API_BASE = process.env.TON_API_BASE || "https://tonapi.io";
export const TON_API_KEY = process.env.TON_API_KEY || "";
export const PING_MESSAGE = process.env.PING_MESSAGE ?? "ping";
export const PORT = Number(process.env.PORT || 3000);
export const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
export const CORS_ORIGIN = process.env.CORS_ORIGIN || ""; // CSV or single origin. Empty => allow all in dev
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
export const APP_BASE_URL = process.env.APP_BASE_URL || "";
export const APP_TENANT_ID = process.env.APP_TENANT_ID || null;

export default {
  DATABASE_URL,
  TON_API_BASE,
  TON_API_KEY,
  PING_MESSAGE,
  PORT,
  ADMIN_SECRET,
  CORS_ORIGIN,
  TELEGRAM_BOT_TOKEN,
  APP_BASE_URL,
  APP_TENANT_ID,
};
