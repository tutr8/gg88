import { useEffect, useMemo, useState } from "react";
import { useWalletAddress } from "@/hooks/useTon";
import { Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";

interface Order {
  id: string;
  title: string;
  status: "created" | "in_progress" | "completed" | "cancelled";
  makerAddress: string;
  takerAddress?: string | null;
  createdAt: string;
}

interface ConversationSummary {
  id: string;
  kind: "favorites" | "order" | string;
  orderId?: string | null;
  updatedAt: string;
  lastMessage?: {
    text?: string;
    createdAt?: string;
  } | null;
  unreadCount: number;
}

export default function Chat() {
  const addr = useWalletAddress();
  const [orders, setOrders] = useState<Order[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!addr) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        await fetch(apiUrl(`/api/chat/self`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: addr }),
        }).catch((error) => console.error("ensure self chat", error));

        const urlOrders = apiUrl(
          `/api/orders?address=${encodeURIComponent(addr)}&role=any`,
        );
        const urlConversations = apiUrl(
          `/api/conversations?address=${encodeURIComponent(addr)}`,
        );

        const [ordersRes, conversationsRes] = await Promise.all([
          fetch(urlOrders),
          fetch(urlConversations),
        ]);

        const [ordersJson, conversationsJson] = await Promise.all([
          ordersRes.ok ? ordersRes.json() : Promise.resolve({ items: [] }),
          conversationsRes.ok
            ? conversationsRes.json()
            : Promise.resolve({ conversations: [] }),
        ]);

        if (cancelled) return;

        const nextOrders = ((ordersJson.items ?? []) as any[]).map((o) => ({
          id: String(o.id),
          title: String(o.title || "Order"),
          status: o.status,
          makerAddress: String(o.makerAddress || ""),
          takerAddress: o.takerAddress || null,
          createdAt: String(o.createdAt || new Date().toISOString()),
        }));

        const nextConversations = (
          (conversationsJson.conversations ?? []) as any[]
        ).map((c) => ({
          id: String(c.id),
          kind: String(c.kind),
          orderId: c.orderId ?? null,
          updatedAt: String(c.updatedAt ?? new Date().toISOString()),
          lastMessage: c.lastMessage
            ? {
                text: String(c.lastMessage.text || ""),
                createdAt: String(
                  c.lastMessage.createdAt || new Date().toISOString(),
                ),
              }
            : null,
          unreadCount: Number(c.unreadCount ?? 0),
        }));

        setOrders(nextOrders);
        setConversations(nextConversations);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [addr]);

  useEffect(() => {
    if (!addr) return;

    const src = new EventSource(
      apiUrl(`/api/stream?address=${encodeURIComponent(addr)}`),
    );

    const refresh = async () => {
      try {
        const urlConversations = apiUrl(
          `/api/conversations?address=${encodeURIComponent(addr)}`,
        );
        const conversationsRes = await fetch(urlConversations);
        const conversationsJson = conversationsRes.ok
          ? await conversationsRes.json()
          : { conversations: [] };
        const nextConversations = (
          (conversationsJson.conversations ?? []) as any[]
        ).map((c) => ({
          id: String(c.id),
          kind: String(c.kind),
          orderId: c.orderId ?? null,
          updatedAt: String(c.updatedAt ?? new Date().toISOString()),
          lastMessage: c.lastMessage
            ? {
                text: String(c.lastMessage.text || ""),
                createdAt: String(
                  c.lastMessage.createdAt || new Date().toISOString(),
                ),
              }
            : null,
          unreadCount: Number(c.unreadCount ?? 0),
        }));
        setConversations(nextConversations);
      } catch {}
    };

    const onEvent = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data || "{}");
        const type = (data?.type as string) || e.type;
        if (type !== "chat.message") return;
        refresh();
      } catch {}
    };

    src.addEventListener("chat.message", onEvent as any);

    return () => {
      try { src.close(); } catch {}
    };
  }, [addr]);

  const orderMap = useMemo(() => {
    const map = new Map<string, Order>();
    for (const order of orders) {
      map.set(order.id, order);
    }
    return map;
  }, [orders]);

  const favoritesConversation = useMemo(
    () => conversations.find((c) => c.kind === "favorites") || null,
    [conversations],
  );

  const orderThreads = useMemo(() => {
    return conversations
      .filter((c) => c.kind === "order")
      .map((conversation) => ({
        conversation,
        order: conversation.orderId ? orderMap.get(conversation.orderId) : null,
      }));
  }, [conversations, orderMap]);

  const sections = useMemo(() => {
    const inProgress = orderThreads.filter((entry) => {
      const status = entry.order?.status;
      return status === "created" || status === "in_progress";
    });
    const completed = orderThreads.filter(
      (entry) => entry.order?.status === "completed",
    );
    const other = orderThreads.filter(
      (entry) => !inProgress.includes(entry) && !completed.includes(entry),
    );
    return { inProgress, completed, other };
  }, [orderThreads]);

  return (
    <div className="min-h-[calc(100dvh-160px)] bg-[hsl(217,33%,9%)] text-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold">Chat</h1>
        {!addr && (
          <div className="mt-3 text-white/70">
            Connect wallet to see your threads.
          </div>
        )}

        {loading && <div className="mt-4 text-white/70">Loading…</div>}

        {!loading && addr && (
          <>
            <h2 className="mt-6 text-sm font-semibold text-white/60">Inbox</h2>
            <div className="mt-2 space-y-2">
              {favoritesConversation && (
                <Link
                  to={`/chat/${favoritesConversation.id}`}
                  className="block rounded-lg border border-white/10 bg-white/10 p-3 hover:bg-white/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate">Favorites</div>
                    {favoritesConversation.unreadCount > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        {favoritesConversation.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/60 mt-1">
                    Private notes
                  </div>
                </Link>
              )}
              {!favoritesConversation && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-white/70">
                  Favorites thread will appear once created.
                </div>
              )}
            </div>

            <h2 className="mt-6 text-sm font-semibold text-white/60">
              Active orders
            </h2>
            <div className="mt-2 space-y-2">
              {sections.inProgress.length === 0 && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-white/70">
                  No active threads.
                </div>
              )}
              {sections.inProgress.map(({ conversation, order }) => (
                <Link
                  key={conversation.id}
                  to={`/chat/${conversation.id}`}
                  className="block rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate">
                      {order?.title ?? "Order Chat"}
                    </div>
                    {conversation.unreadCount > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/60 mt-1">
                    {(order?.status ?? "").replace("_", " ") || "active"} •{" "}
                    {conversation.lastMessage?.createdAt
                      ? new Date(
                          conversation.lastMessage.createdAt,
                        ).toLocaleString()
                      : new Date(conversation.updatedAt).toLocaleString()}
                  </div>
                  {conversation.lastMessage?.text && (
                    <div className="mt-1 truncate text-xs text-white/40">
                      {conversation.lastMessage.text}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            <h2 className="mt-6 text-sm font-semibold text-white/60">
              Completed
            </h2>
            <div className="mt-2 space-y-2">
              {sections.completed.length === 0 && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-white/70">
                  No completed orders yet.
                </div>
              )}
              {sections.completed.map(({ conversation, order }) => (
                <Link
                  key={conversation.id}
                  to={`/chat/${conversation.id}`}
                  className="block rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate">
                      {order?.title ?? "Order Chat"}
                    </div>
                    {conversation.unreadCount > 0 && (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/60 mt-1">
                    Completed •{" "}
                    {conversation.lastMessage?.createdAt
                      ? new Date(
                          conversation.lastMessage.createdAt,
                        ).toLocaleString()
                      : new Date(conversation.updatedAt).toLocaleString()}
                  </div>
                  {conversation.lastMessage?.text && (
                    <div className="mt-1 truncate text-xs text-white/40">
                      {conversation.lastMessage.text}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {sections.other.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-white/60">
                  Other threads
                </h2>
                <div className="mt-2 space-y-2">
                  {sections.other.map(({ conversation, order }) => (
                    <Link
                      key={conversation.id}
                      to={`/chat/${conversation.id}`}
                      className="block rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium truncate">
                          {order?.title ?? "Thread"}
                        </div>
                        {conversation.unreadCount > 0 && (
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        {conversation.lastMessage?.createdAt
                          ? new Date(
                              conversation.lastMessage.createdAt,
                            ).toLocaleString()
                          : new Date(conversation.updatedAt).toLocaleString()}
                      </div>
                      {conversation.lastMessage?.text && (
                        <div className="mt-1 truncate text-xs text-white/40">
                          {conversation.lastMessage.text}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
