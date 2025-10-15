import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ensureUserByAddress } from "./user-service";
import { APP_TENANT_ID } from "../config";

export function normalizeAddress(address: string) {
  return address.trim().toLowerCase();
}

export async function ensureFavoritesConversation(address: string) {
  const normalized = normalizeAddress(address);
  const user = await ensureUserByAddress(normalized);
  let conversation = await prisma.conversation.findFirst({
    where: { kind: Prisma.ConversationKind.favorites, ownerId: user.id },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        kind: Prisma.ConversationKind.favorites,
        ownerId: user.id,
        tenantId: APP_TENANT_ID,
        participants: {
          create: {
            address: normalized,
            role: Prisma.ParticipantRole.owner,
            userId: user.id,
          },
        },
      },
    });
  } else {
    await prisma.conversationParticipant.upsert({
      where: {
        conversationId_address: {
          conversationId: conversation.id,
          address: normalized,
        },
      },
      update: {
        role: Prisma.ParticipantRole.owner,
        userId: user.id,
      },
      create: {
        conversationId: conversation.id,
        address: normalized,
        role: Prisma.ParticipantRole.owner,
        userId: user.id,
      },
    });
  }

  return { conversation, user } as const;
}

export async function ensureOrderConversation(
  orderId: string,
  makerAddress: string,
  takerAddress?: string | null,
) {
  const normalizedMaker = normalizeAddress(makerAddress);
  const normalizedTaker = takerAddress ? normalizeAddress(takerAddress) : null;
  const makerUser = await ensureUserByAddress(normalizedMaker);
  const takerUser = normalizedTaker
    ? await ensureUserByAddress(normalizedTaker)
    : null;

  let conversation = await prisma.conversation.findFirst({
    where: { orderId },
  });

  if (!conversation) {
    const participantsData: any[] = [
      {
        address: normalizedMaker,
        role: Prisma.ParticipantRole.maker,
        userId: makerUser.id,
      },
    ];
    if (normalizedTaker && takerUser) {
      participantsData.push({
        address: normalizedTaker,
        role: Prisma.ParticipantRole.taker,
        userId: takerUser.id,
      });
    }
    conversation = await prisma.conversation.create({
      data: {
        kind: Prisma.ConversationKind.order,
        orderId,
        tenantId: APP_TENANT_ID,
        participants: {
          create: participantsData,
        },
      },
    });
  } else {
    await prisma.conversationParticipant.upsert({
      where: {
        conversationId_address: {
          conversationId: conversation.id,
          address: normalizedMaker,
        },
      },
      update: { role: Prisma.ParticipantRole.maker, userId: makerUser.id },
      create: {
        conversationId: conversation.id,
        address: normalizedMaker,
        role: Prisma.ParticipantRole.maker,
        userId: makerUser.id,
      },
    });
    if (normalizedTaker && takerUser) {
      await prisma.conversationParticipant.upsert({
        where: {
          conversationId_address: {
            conversationId: conversation.id,
            address: normalizedTaker,
          },
        },
        update: { role: Prisma.ParticipantRole.taker, userId: takerUser.id },
        create: {
          conversationId: conversation.id,
          address: normalizedTaker,
          role: Prisma.ParticipantRole.taker,
          userId: takerUser.id,
        },
      });
    }
  }

  return conversation;
}

export async function getConversationByIdentifier(params: {
  conversationId?: string;
  orderId?: string;
}) {
  if (params.conversationId) {
    return prisma.conversation.findUnique({
      where: { id: params.conversationId },
    });
  }
  if (params.orderId) {
    return prisma.conversation.findFirst({
      where: { orderId: params.orderId },
    });
  }
  return null;
}

export async function ensureParticipantAccess(
  conversationId: string,
  address: string,
) {
  const normalized = normalizeAddress(address);
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_address: { conversationId, address: normalized } },
  });
  if (!participant) {
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }
  return participant;
}

export async function markConversationAsImportant(
  conversationId: string,
  importance: Prisma.InboxImportance,
) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { metadata: { importance } },
  });
}