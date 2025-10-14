import { createRequire } from "module";
import { mockPrisma } from "../server/lib/mock-prisma";

// Объявляем типы вручную чтобы избежать зависимостей
interface PrismaClientType {
  // Добавьте здесь основные методы которые вы используете
  [key: string]: any;
}

type PrismaLike = PrismaClientType | typeof mockPrisma;

type GlobalWithPrisma = typeof globalThis & {
  __fusionPrisma?: PrismaLike;
};

const globalForPrisma = globalThis as GlobalWithPrisma;

const createPrismaClient = (): PrismaLike => {
  // В продакшн среде пытаемся использовать реальный Prisma
  if (process.env.NODE_ENV === 'production') {
    try {
      // @ts-ignore - игнорируем проверку типов
      const require = createRequire(import.meta.url);
      const { PrismaClient } = require('@prisma/client');
      return new PrismaClient();
    } catch (error) {
      console.warn('Failed to create Prisma client:', error);
    }
  }
  
  // В development или если Prisma недоступен, используем mock
  return mockPrisma;
};

export const prisma: any =
  globalForPrisma.__fusionPrisma ??
  (globalForPrisma.__fusionPrisma = createPrismaClient());

export default prisma;
