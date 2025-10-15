import type { Response } from "express";
import { prisma } from "./prisma";
import { unwrapContent } from "./encryption";

export type SSEClient = {
  address: string;
  res: Response;
  heartbeat: NodeJS.Timer;
};

const clients = new Map<string, Set<SSEClient>>();

function send(res: Response, event: string, data: unknown) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  res.write(payload);
}

export function subscribe(address: string, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const entry: SSEClient = {
    address,
    res,
    heartbeat: setInterval(() => {
      try {
        res.write(":keep-alive\n\n");
      } catch {}
    }, 25000),
  };

  const bucket = clients.get(address) ?? new Set<SSEClient>();
  bucket.add(entry);
  clients.set(address, bucket);

  send(res, "ready", { ok: true });

  const cleanup = () => {
    clearInterval(entry.heartbeat);
    const b = clients.get(address);
    if (b) {
      b.delete(entry);
      if (b.size === 0) clients.delete(address);
    }
    try { res.end(); } catch {}
  };

  res.on("close", cleanup);
  res.on("error", cleanup);
}

export async function notifyNewItem(item: any) {
  try {
    const payloadRaw = item.encryptedContent ?? item.content ?? {};
    const content = unwrapContent(payloadRaw);
    const text = (content as any)?.args?.text || (content as any)?.text || "";

    const addrSet = new Set<string>();
    if (item.address) addrSet.add(String(item.address));

    if (item.conversationId) {
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId: String(item.conversationId) },
        select: { address: true },
      });
      for (const p of participants) if (p.address) addrSet.add(p.address);
    }

    const data = {
      type: "chat.message",
      conversationId: String(item.conversationId || ""),
      message: {
        id: String(item.id),
        text: String(text),
        address: String(item.address || ""),
        createdAt: String(item.createdAt || new Date().toISOString()),
      },
    };

    for (const address of addrSet) {
      const bucket = clients.get(address);
      if (!bucket || bucket.size === 0) continue;
      for (const client of bucket) {
        try {
          send(client.res, "chat.message", data);
        } catch {}
      }
    }
  } catch {}
}

export async function notifyTyping(params: { conversationId: string; from: string; typing: boolean; }) {
  const { conversationId, from, typing } = params;
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { address: true },
  });
  for (const p of participants) {
    const addr = p.address;
    if (!addr || addr === from) continue;
    const bucket = clients.get(addr);
    if (!bucket) continue;
    for (const client of bucket) {
      try {
        send(client.res, "chat.typing", { type: "chat.typing", conversationId, from, typing });
      } catch {}
    }
  }
}

export async function notifyRead(params: { conversationId: string; by: string; at?: string; }) {
  const { conversationId, by } = params;
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { address: true },
  });
  for (const p of participants) {
    const addr = p.address;
    if (!addr || addr === by) continue;
    const bucket = clients.get(addr);
    if (!bucket) continue;
    for (const client of bucket) {
      try {
        send(client.res, "chat.read", { type: "chat.read", conversationId, by, at: params.at || new Date().toISOString() });
      } catch {}
    }
  }
}
