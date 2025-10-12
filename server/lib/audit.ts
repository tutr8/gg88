import { prisma } from "./prisma";

interface AuditParams {
  actorAddress?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  tenantId?: string | null;
}

export async function writeAuditLog(params: AuditParams) {
  await prisma.auditLog.create({
    data: {
      actorAddress: params.actorAddress ?? null,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata ?? null,
      tenantId: params.tenantId ?? null,
    },
  });
}
