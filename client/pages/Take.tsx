import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api";

interface Offer {
  id: string;
  title: string;
  description?: string;
  budgetTON: number;
  status: string;
  createdAt: string;
  imageUrl?: string | null;
}

export default function Take() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [showDescId, setShowDescId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<{
    x: number;
    y: number;
    id: string;
  } | null>(null);
  const [moved, setMoved] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function loadOffers() {
      setLoading(true);
      setError(null);

      const query = q ? `?q=${encodeURIComponent(q)}` : "";
      try {
        const r = await fetch(apiUrl(`/api/offers${query}`));
        if (!mounted) return;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json().catch(() => ({ items: [] }));
        {
          const mapped = (json.items || []).map((d: any) => ({
            id: String(d.id ?? crypto.randomUUID()),
            title: String(d.title ?? ""),
            description: String(d.description ?? ""),
            budgetTON: Number(d.budgetTON ?? 0),
            status: String(d.status ?? "open"),
            createdAt: String(d.createdAt ?? new Date().toISOString()),
            imageUrl: d.imageUrl ?? null,
          }));
          const seen = new Set<string>();
          const deduped: Offer[] = [];
          for (let i = mapped.length - 1; i >= 0; i--) {
            const it = mapped[i];
            if (seen.has(it.id)) continue;
            seen.add(it.id);
            deduped.unshift(it);
          }
          setOffers(deduped);
        }
      } catch (e) {
        // Be resilient: show empty list instead of an error banner
        setOffers([]);
        setError(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const t = setTimeout(loadOffers, 250);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="min-h-screen bg-[hsl(217,33%,9%)] text-white">
      <div className="mx-auto w-full max-w-2xl px-4 pt-6">
        <h1 className="text-3xl font-bold">Take</h1>
        <p className="mt-2 text-white/70">
          Browse and accept offers. Escrow-backed payments ensure risk‑free
          collaboration.
        </p>

        <div className="mt-6">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search offers"
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 mb-16">
          {" "}
          {/* ДОБАВЛЕНО: mb-32 */}
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
          {error && (
            <div className="col-span-2 rounded-lg border border-red-600 bg-red-900/30 p-3 text-xs text-red-200">
              Failed to load offers: {error}
            </div>
          )}
          {!loading && !error && offers.length === 0 && (
            <div className="col-span-2 rounded-lg border border-white/10 bg-white/5 p-4 text-center text-white/70">
              No offers yet. Be the first to create one.
            </div>
          )}
          {offers.map((o) => (
            <div
              key={o.id}
              onClick={() => {
                if (moved) return;
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
                  <div className="truncate text-sm font-medium">{o.title}</div>
                  <div className="mt-1 text-xs text-white/60">
                    {o.budgetTON} TON •{" "}
                    {new Date(o.createdAt).toLocaleDateString()}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* ДОБАВЛЕНО: Пустой div для создания дополнительного пространства */}
        <div className="h-32"></div>
      </div>
    </div>
  );
}
