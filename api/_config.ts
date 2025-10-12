export const TON_API_BASE = (
  process.env.TON_API_BASE || "https://tonapi.io"
).replace(/\/$/, "");
export const TON_API_KEY = process.env.TON_API_KEY || "";
export const DATABASE_URL = process.env.DATABASE_URL || "";

export const ADMIN_WHITELIST = (
  process.env.ADMIN_WHITELIST ||
  "UQAWu58d_mVEwZl4JdGjDRDapBg5Rbr62NLkIvGAw5u6ayct"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
export const TREASURY_ADDRESS =
  process.env.TREASURY_ADDRESS ||
  "UQAWu58d_mVEwZl4JdGjDRDapBg5Rbr62NLkIvGAw5u6ayct";
export const N_PERCENT = Number(process.env.N_PERCENT || "1");
