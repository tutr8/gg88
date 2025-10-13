import { Bot, ChevronRight, Plus, Search, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import { useEffect, useState } from "react";

type BotItem = {
  name: string;
  path: string;
  handle?: string;
  color: string;
  image?: string;
};

const BOTS: BotItem[] = [
  { name: "Make", path: "/offer/new", color: "bg-violet-500" },
  { name: "Take", path: "/take", color: "bg-amber-500" },
  { name: "Learn", path: "/learn", color: "bg-emerald-500" },
  { name: "Profile", path: "/profile", color: "bg-sky-500" },
];

function BotRow({ item }: { item: BotItem }) {
  return (
    <Link
      to={item.path}
      className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/5"
    >
      <div
        className={`grid h-10 w-10 place-items-center rounded-full ${item.color} text-white`}
      >
        {item.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white truncate">
          {item.name}
        </div>
        {item.handle && (
          <div className="text-xs text-white/60 truncate">{item.handle}</div>
        )}
      </div>
      <ChevronRight className="size-5 text-white/40" />
    </Link>
  );
}

interface Offer {
  id: string;
  title: string;
  description?: string;
  budgetTON: number;
  status: string;
  createdAt: string;
  imageUrl?: string | null;
}

export default function Index() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDescId, setShowDescId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<{
    x: number;
    y: number;
    id: string;
  } | null>(null);
  const [moved, setMoved] = useState(false);
  const [q, setQ] = useState("");
  const [stack, setStack] = useState("");
  const [minBudget, setMinBudget] = useState<string>("");
  const [maxBudget, setMaxBudget] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (stack) params.set("stack", stack);
        if (minBudget) params.set("minBudget", minBudget);
        if (maxBudget) params.set("maxBudget", maxBudget);
        const r = await fetch(
          apiUrl(`/api/offers${params.size ? `?${params.toString()}` : ""}`),
          { signal: ctrl.signal },
        );
        const json = r.ok
          ? await r.json().catch(() => ({ items: [] }))
          : { items: [] };
        if (!mounted) return;
        setOffers(
          (json.items || []).map((d: any) => ({
            id: String(d.id ?? crypto.randomUUID()),
            title: String(d.title ?? ""),
            description: String(d.description ?? ""),
            budgetTON: Number(d.budgetTON ?? 0),
            status: String(d.status ?? "open"),
            createdAt: String(d.createdAt ?? new Date().toISOString()),
            imageUrl: d.imageUrl ?? null,
          })),
        );
      } catch (e: any) {
        if (!mounted || e?.name === "AbortError") return;
        setOffers([]);
        setError(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }, 250);
    return () => {
      mounted = false;
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, stack, minBudget, maxBudget]);

  return (
    <div className="min-h-[calc(100dvh-160px)] bg-[hsl(217,33%,9%)] text-white pb-32"> {/* Увеличил до pb-32 */}
      <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-10">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg" />
            <div className="relative grid place-items-center rounded-full bg-gradient-to-b from-white/10 to-white/5 p-[2px]">
              <div className="grid size-20 place-items-center rounded-full bg-[hsl(218,28%,13%)]">
                <Bot className="size-10 text-primary" />
              </div>
            </div>
          </div>
        </div>

        <h1 className="mt-5 text-center text-2xl font-bold tracking-tight">
          FreelTON
        </h1>
        <div className="mt-2 text-center text-sm text-white/70 space-y-1">
          <p>FreelTON is crypto freelance based on TON.</p>
          <p className="font-semibold text-[16px]">
            Freedom to Create. Assurance to Launch. Risk-Free
          </p>
          <a className="text-primary hover:underline" href="#">
            Learn more
          </a>
        </div>

        <div className="mt-6 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="h-11 rounded-xl bg-white/5 pl-10 text-white placeholder:text-white/50 border-white/10 focus-visible:ring-primary"
          />
          <button
            aria-label={showFilters ? "Close filters" : "Open filters"}
            onClick={() => setShowFilters((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center rounded-md p-2 text-white/80 hover:bg-white/10"
          >
            {showFilters ? (
              <X className="size-4" />
            ) : (
              <Settings className="size-4" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                placeholder="Stack (e.g. React, TON)"
                className="h-10 rounded-lg bg-white/5 text-white placeholder:text-white/50 border-white/10"
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={minBudget}
                  onChange={(e) => setMinBudget(e.target.value)}
                  placeholder="Min TON"
                  className="h-10 rounded-lg bg-white/5 text-white placeholder:text-white/50 border-white/10"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  placeholder="Max TON"
                  className="h-10 rounded-lg bg-white/5 text-white placeholder:text-white/50 border-white/10"
                />
              </div>
            </div>
          </div>
        )}

        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-white/60">
          <p>My job listings</p>
        </h2>

        <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Button
            asChild
            variant="ghost"
            className="h-9 rounded-lg px-2 text-primary hover:bg-primary/10"
          >
            <Link to="/offer/new">
              <Plus className="mr-2 size-4" /> Create a New Offer
            </Link>
          </Button>
        </div>

        <Separator className="my-4 bg-white/10" />

        {error && (
          <div className="rounded-lg border border-red-600 bg-red-900/30 p-3 text-xs text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div className="mb-2 h-24 w-full rounded-lg bg-white/10" />
                <div className="h-4 w-3/4 rounded bg-white/10" />
              </div>
            ))}

          {!loading &&
            offers.map((o) => (
              <div
                key={o.id}
                onClick={() => {
                  if (moved) return; // ignore click after swipe
                  setShowDescId((prev) => (prev === o.id ? null : o.id));
                }}
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  setTouchStart({ x: t.clientX, y: t.clientY, id: o.id });
                  setMoved(false);
                }}
                onTouchMove={(e) => {
                  if (!touchStart) return;
                  const t = e.touches[0];
                  const dx = t.clientX - touchStart.x;
                  const dy = t.clientY - touchStart.y;
                  if (Math.abs(dx) > 12 || Math.abs(dy) > 12) setMoved(true);
                }}
                onTouchEnd={() => {
                  if (moved && touchStart?.id === o.id) {
                    setShowDescId((prev) => (prev === o.id ? null : o.id));
                  }
                  setTouchStart(null);
                  setMoved(false);
                }}
                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors"
              >
                <div className="mb-2 overflow-hidden rounded-lg bg-white/10">
                  {o.imageUrl ? (
                    <img
                      src={o.imageUrl}
                      alt={o.title}
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="h-24 w-full bg-gradient-to-br from-white/10 to-white/5" />
                  )}
                </div>
                {showDescId === o.id ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{o.title}</div>
                    <div className="text-sm text-white/80 whitespace-pre-wrap">
                      {o.description || "No description"}
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <div>
                        {o.budgetTON} TON •{" "}
                        {new Date(o.createdAt).toLocaleDateString()}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/offer/${o.id}`, { state: { offer: o } });
                        }}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="truncate text-sm font-medium">
                      {o.title}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {o.budgetTON} TON •{" "}
                      {new Date(o.createdAt).toLocaleDateString()}
                    </div>
                  </>
                )}
              </div>
            ))}

          {!loading && offers.length === 0 && (
            <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 p-4 text-center text-white/70">
              No offers yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
