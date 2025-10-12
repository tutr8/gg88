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
      if (!res.ok) {
        throw new Error(`Failed to load conversation: ${res.status}`);
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
    <div className="min-h-screen bg-[hsl(217,33%,9%)] text-white">
      <div className="mx-auto flex h-[770px] w-full max-w-2xl flex-col px-4 py-6">
        <div className="mb-3 text-lg font-semibold">
          {conversation?.title ||
            (conversation?.kind === "favorites" ? "Favorites" : "Chat")}
        </div>
        <div className="flex-1 min-h-0 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3">
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
                  <div className="inline-block max-w-[85%] rounded-lg bg-white/10 px-3 py-2 text-sm">
                    <div className="opacity-70 text-[11px]">
                      {mine ? "You" : m.sender.slice(0, 6) + "…"}
                    </div>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  </div>
                </div>
              );
            })}
          <div ref={bottomRef} />
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            className="bg-white/5 text-white border-white/10"
          />
          <Button onClick={send} className="bg-primary text-primary-foreground">
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
