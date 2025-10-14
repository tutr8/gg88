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
      });
      const mapped = (data.messages ?? []).map((m: any) => ({
        id: String(m.id),
        sender: String(m.address || ""),
        text: String(m.text || ""),
        createdAt: String(m.createdAt || new Date().toISOString()),
      }));
      setMessages(mapped);
      setError(null);
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id || !me) return;
    let mounted = true;
    let timer: number | undefined;

    const tick = async () => {
      if (!mounted) return;
      await load(me);
      if (!mounted) return;
      timer = window.setTimeout(tick, 4000);
    };

    tick();

    return () => {
      mounted = false;
      if (timer) window.clearTimeout(timer);
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

    await fetch(apiUrl(`/api/inbox`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (me) {
      await load(me);
    }
  }

  return (
    <div className="h-screen bg-[hsl(217,33%,9%)] text-white flex flex-col">
      <div className="flex-1 min-h-0 w-full max-w-2xl mx-auto flex flex-col px-4 py-4">
        <div className="mb-2 text-lg font-semibold truncate flex-shrink-0">
          {conversation?.title ||
            (conversation?.kind === "favorites" ? "Favorites" : "Chat")}
        </div>

        {!me && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-white/70">
            Connect wallet to access this chat.
          </div>
        )}

        {me && (
          <>
            <div className="flex-1 min-h-0 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3">
              {loading && <div className="text-white/70">Loading…</div>}
              {error && !loading && <div className="text-white/70">{error}</div>}
              {!loading && !error && messages.length === 0 && (
                <div className="text-white/70">No messages yet.</div>
              )}
              {!loading &&
                !error &&
                messages.map((m) => {
                  const mine = me && m.sender && me === m.sender;
                  return (
                    <div key={m.id} className={mine ? "text-right" : "text-left"}>
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

            <div className="mt-2 flex gap-2 flex-shrink-0">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
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
          </>
        )}
      </div>
    </div>
  );
}
