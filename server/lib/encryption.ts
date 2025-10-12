import crypto from "crypto";

const RAW_KEY = process.env.MESSAGE_ENCRYPTION_KEY;
const KEY = RAW_KEY
  ? crypto.createHash("sha256").update(RAW_KEY).digest()
  : null;

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

interface EncryptedPayload {
  v: number;
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  data: string;
}

type Content = JsonValue;

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    typeof value === "object" &&
    !!value &&
    (value as any).v === 1 &&
    (value as any).alg === "aes-256-gcm" &&
    typeof (value as any).iv === "string" &&
    typeof (value as any).tag === "string" &&
    typeof (value as any).data === "string"
  );
}

export function wrapContent(content: Content): Content {
  if (!KEY) return content;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const serialized = Buffer.from(JSON.stringify(content));
  const encrypted = Buffer.concat([cipher.update(serialized), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedPayload = {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
  return payload as unknown as Content;
}

export function unwrapContent(content: Content): Content {
  if (!KEY) return content;
  if (!isEncryptedPayload(content)) return content;
  const iv = Buffer.from(content.iv, "base64");
  const tag = Buffer.from(content.tag, "base64");
  const encrypted = Buffer.from(content.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  const parsed = JSON.parse(decrypted.toString("utf8"));
  return parsed as Content;
}

export function isEncryptionActive() {
  return Boolean(KEY);
}
