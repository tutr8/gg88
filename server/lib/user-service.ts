import { prisma } from "./prisma";

export async function ensureUserByAddress(address: string) {
  const trimmed = address.trim().toLowerCase();
  if (!trimmed) throw new Error("address_required");
  const existing = await prisma.user.findUnique({
    where: { address: trimmed },
  });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      address: trimmed,
    },
  });
}
