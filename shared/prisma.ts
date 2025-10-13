import pkg from "@prisma/client";
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { mockPrisma } from "../server/lib/mock-prisma";

type PrismaLike = PrismaClientType | typeof mockPrisma;

type GlobalWithPrisma = typeof globalThis & {
  __fusionPrisma?: PrismaLike;
};

const globalForPrisma = globalThis as GlobalWithPrisma;

const createPrismaClient = (): PrismaLike => {
  try {
    const { PrismaClient } = pkg as {
      PrismaClient: new (...args: any[]) => PrismaClientType;
    };
    return new PrismaClient();
  } catch (_error) {
    return mockPrisma;
  }
};

export const prisma: PrismaLike =
  globalForPrisma.__fusionPrisma ??
  (globalForPrisma.__fusionPrisma = createPrismaClient());

export default prisma;
