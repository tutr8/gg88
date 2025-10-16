import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useWalletAddress } from "@/hooks/useTon";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConversationDetail {
  id: string;
  kind: string;
  orderId?: string | null;
  title?: string | null;
  deadlineISO?: string | null;
}

interface Message {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
}

export default function ChatRoom() {
  const { id } = useParams<{ id: string }>();
  const me = useWalletAddress();
  const [conversation, setConversation] = useState<ConversationDetail | null>(
    null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [someoneTyping, setSomeoneTyping] = useState(false);
  const typingTimers = useRef<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const lang = (typeof navigator !== "undefined" && navigator.language) || "en";

  async function load(address: string) {
    if (!id) return;
    setLoading(true);
    try {
      const url = apiUrl(
        `/api/conversations/${id}?address=${encodeURIComponent(address)}`,
      );
      const res = await fetch(url);
      if (res.status === 404) {
        setError("Thread not found");
        setConversation(null);
        setMessages([]);
        return;
      }
      if (res.status === 403) {
        setError("Access denied");
        setConversation(null);
        setMessages([]);
        return;
      }
      if (!res.ok) {
        setError(`Failed to load conversation (${res.status})`);
        setConversation(null);
        setMessages([]);
        return;
      }
      const data = await res.json();
      setConversation({
        id: String(data.conversation?.id ?? id),
        kind: String(data.conversation?.kind ?? "unknown"),
        orderId: data.conversation?.orderId ?? null,
        title: data.conversation?.metadata?.title ?? null,
        deadlineISO: data.conversation?.metadata?.deadlineISO ?? null,
      });
      const mapped = (data.messages ?? []).map((m: any) => ({
        id: String(m.id),
        sender: String(m.address || ""),
        text: String(m.text || ""),
        createdAt: String(m.createdAt || new Date().toISOString()),
      }));
      // Deduplicate by id and by content signature within a short window
      const byId = new Set<string>();
      const bySig = new Set<string>();
      const windowMs = 30_000; // 30s window for same-sender same-text
      const deduped: Message[] = [];
      for (let i = 0; i < mapped.length; i++) {
        const msg = mapped[i];
        if (byId.has(msg.id)) continue;
        const ts = Date.parse(msg.createdAt) || 0;
        const sig = `${msg.sender}\u0001${msg.text}\u0001${Math.floor(ts / windowMs)}`;
        if (bySig.has(sig)) continue;
        byId.add(msg.id);
        bySig.add(sig);
        deduped.push(msg);
      }
      setMessages(deduped);
      setError(null);
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
      // Mark as read when loaded
      try {
        await fetch(apiUrl(`/api/inbox/read`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: id, address }),
        });
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id || !me) return;

    load(me);

    const src = new EventSource(
      apiUrl(`/api/stream?address=${encodeURIComponent(me)}`),
    );

    const onMessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data || "{}");
        if (String(data.conversationId || "") !== String(id)) return;
        const m = data.message || {};
        const newMsg: Message = {
          id: String(m.id || Math.random()),
          sender: String(m.address || ""),
          text: String(m.text || ""),
          createdAt: String(m.createdAt || new Date().toISOString()),
        };
        setMessages((prev) => {
          // By id
          const existsById = prev.some((x) => x.id === newMsg.id);
          if (existsById) {
            return prev.map((x) => (x.id === newMsg.id ? newMsg : x));
          }
          // By content signature within 15s window
          const tsNew = Date.parse(newMsg.createdAt) || Date.now();
          const existsBySig = prev.some((x) => {
            const tsX = Date.parse(x.createdAt) || 0;
            return (
              x.sender === newMsg.sender &&
              x.text === newMsg.text &&
              Math.abs(tsX - tsNew) <= 15_000
            );
          });
          if (existsBySig) return prev;
          return [...prev, newMsg];
        });
        setTimeout(
          () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
          30,
        );
      } catch {}
    };

    const onTyping = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data || "{}");
        if (String(data.conversationId || "") !== String(id)) return;
        const from = String(data.from || "");
        if (from && from !== me) {
          setSomeoneTyping(Boolean(data.typing));
          const timers = typingTimers.current;
          if (timers[from]) window.clearTimeout(timers[from]);
          timers[from] = window.setTimeout(() => {
            setSomeoneTyping(false);
            delete typingTimers.current[from];
          }, 3000);
        }
      } catch {}
    };

    src.addEventListener("chat.message", onMessage as any);
    src.addEventListener("chat.typing", onTyping as any);

    return () => {
      try {
        src.close();
      } catch {}
      for (const k of Object.keys(typingTimers.current)) {
        window.clearTimeout(typingTimers.current[k]);
      }
      typingTimers.current = {};
    };
  }, [id, me]);

  async function send() {
    if (!id || !me || !text.trim()) return;
    const payload: Record<string, unknown> = {
      conversationId: id,
      address: me,
      channel: "chat",
      type: "message",
      importance: "normal",
      lang,
      content: { key: "chat.message", args: { text } },
      meta: { source: "chat_client" },
    };
    if (conversation?.orderId) {
      payload.orderId = conversation.orderId;
    }

    setText("");


    const res = await fetch(apiUrl(`/api/inbox`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    try {
      await res.json();
    } catch {}

    // Mark read (self)
    try {
      await fetch(apiUrl(`/api/inbox/read`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id, address: me }),
      });
    } catch {}
  }

  return (
    <div className="h-screen overflow-hidden bg-[hsl(217,33%,9%)] text-white flex flex-col">
      <div className="flex-1 min-h-0 w-full max-w-2xl mx-auto flex flex-col px-4 py-4 mb-[calc(160px+env(safe-area-inset-bottom))]">
        <div className="mb-1 text-lg font-semibold truncate flex-shrink-0">
          {conversation?.title ||
            (conversation?.kind === "favorites" ? "Favorites" : "Chat")}
        </div>
        {conversation?.deadlineISO && (
          <div className="mb-2 text-xs text-white/60">
            Deadline: {new Date(conversation.deadlineISO).toLocaleString()}
          </div>
        )}

        {!me && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-white/70">
            Connect wallet to access this chat.
          </div>
        )}

        {me && (
          <>
            <div className="flex-1 min-h-0 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3">
              {loading && <div className="text-white/70">Loading…</div>}
              {!loading && !error && someoneTyping && (
                <div className="text-white/50 text-xs">
                  Companion is typing…
                </div>
              )}
              {error && !loading && (
                <div className="text-white/70">{error}</div>
              )}
              {!loading && !error && messages.length === 0 && (
                <div className="text-white/70">No messages yet.</div>
              )}
              {!loading &&
                !error &&
                messages.map((m) => {
                  const mine = me && m.sender && me === m.sender;
                  return (
                    <div
                      key={m.id}
                      className={mine ? "text-right" : "text-left"}
                    >
                      <div className="inline-block max-w-[85%] rounded-lg bg-white/10 px-3 py-1 text-sm">
                        <div className="opacity-70 text-[10px]">
                          {mine ? "You" : m.sender.slice(0, 6) + "…"}
                        </div>
                        <div className="whitespace-pre-wrap">{m.text}</div>
                      </div>
                    </div>
                  );
                })}
              <div ref={bottomRef} />
            </div>

            {someoneTyping && (
              <div className="mt-2 text-xs text-white/60">Typing…</div>
            )}

            {!error && (
              <div className="mt-2 flex gap-2 flex-shrink-0">
                <Input
                  value={text}
                  onChange={async (e) => {
                    const v = e.target.value;
                    setText(v);
                    try {
                      if (me && id) {
                        await fetch(apiUrl(`/api/chat/typing`), {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            address: me,
                            conversationId: id,
                            typing: v.length > 0,
                          }),
                        });
                      }
                    } catch {}
                  }}
                  placeholder="Write a message…"
                  className="bg-white/5 text-white border-white/10 h-8 text-sm"
                />
                <Button
                  onClick={send}
                  className="bg-primary text-primary-foreground h-8 px-3 text-sm"
                >
                  Send
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
