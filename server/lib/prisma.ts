import { mockPrisma } from "./mock-prisma";
import pkg from "@prisma/client";

let prisma: any = mockPrisma;
try {
  const { PrismaClient } = pkg as any;
  prisma = new PrismaClient();
} catch (e) {
  // Fallback to in-memory mock when Prisma client isn't available
  prisma = mockPrisma;
}

export { prisma };
export default prisma;
