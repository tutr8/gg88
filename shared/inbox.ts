import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const InboxChannelEnum = z.enum(["chat", "toast", "email", "push", "log"]);
export const InboxImportanceEnum = z.enum(["low", "normal", "high", "critical"]);
export const InboxTypeEnum = z.enum(["message", "system", "reminder", "alert"]);
export const InboxStatusEnum = z.enum(["pending", "delivering", "delivered", "failed"]);
export const PiiClassEnum = z.enum(["none", "personal", "sensitive"]);

export const InboxContentSchema = z
  .object({
    key: z.string().min(1),
    args: z.record(JsonValueSchema).default({}),
  })
  .strict();

export const InboxMetaSchema = z
  .object({
    traceId: z.string().optional(),
    correlationId: z.string().optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
    localeOverride: z.string().optional(),
    extra: z.record(JsonValueSchema).optional(),
  })
  .strict();

export const InboxPayloadSchema = z
  .object({
    tenantId: z.string().min(1).optional(),
    conversationId: z.string().min(1).optional(),
    threadId: z.string().min(1).optional(),
    orderId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
    type: InboxTypeEnum.default("message"),
    importance: InboxImportanceEnum.default("normal"),
    channel: InboxChannelEnum.default("chat"),
    lang: z.string().min(2).max(10).default("en"),
    content: InboxContentSchema,
    meta: InboxMetaSchema.optional(),
    piiClass: PiiClassEnum.default("none"),
    dedupeKey: z.string().min(1).optional(),
    expiresAt: z.coerce.date().optional(),
    status: InboxStatusEnum.optional(),
    nextAttemptAt: z.coerce.date().optional(),
  })
  .strict();

export type InboxPayloadInput = z.infer<typeof InboxPayloadSchema>;
export type InboxMeta = z.infer<typeof InboxMetaSchema>;
export type InboxContent = z.infer<typeof InboxContentSchema>;
