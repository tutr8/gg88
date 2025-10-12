import { z } from "zod";
import { InboxChannel, InboxImportance, InboxType } from "@prisma/client";

export const createMessageSchema = z
  .object({
    conversationId: z.string().cuid().optional(),
    orderId: z.string().optional(),
    address: z.string().min(1),
    userId: z.string().optional(),
    type: z.nativeEnum(InboxType).default(InboxType.message),
    importance: z.nativeEnum(InboxImportance).default(InboxImportance.normal),
    channel: z.nativeEnum(InboxChannel).default(InboxChannel.chat),
    content: z.union([z.string(), z.record(z.any())]),
    meta: z.record(z.any()).optional(),
    dedupeKey: z.string().optional(),
    tenantId: z.string().optional(),
    ttlSeconds: z
      .number()
      .int()
      .positive()
      .max(60 * 60 * 24 * 30)
      .optional(),
  })
  .refine((data) => data.conversationId || data.orderId, {
    message: "conversationId_or_orderId_required",
    path: ["conversationId"],
  });

export const listMessagesSchema = z
  .object({
    conversationId: z.string().optional(),
    orderId: z.string().optional(),
    address: z.string().min(1),
    limit: z.preprocess(
      (value) => (value == null ? undefined : Number(value)),
      z.number().int().min(1).max(200).optional(),
    ),
    before: z.string().datetime().optional(),
  })
  .refine((data) => data.conversationId || data.orderId, {
    message: "conversationId_or_orderId_required",
    path: ["conversationId"],
  });

export const markReadSchema = z.object({
  conversationId: z.string().cuid(),
  address: z.string().min(1),
  messageIds: z.array(z.string().cuid()).min(1),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
