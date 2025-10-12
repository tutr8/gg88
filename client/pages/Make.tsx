import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import WalletGate from "@/components/WalletGate";

export default function Make() {
  const [tonInfo, setTonInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTonInfo() {
      setError(null);
      const paths = ["/api/ton/info", `${window.location.origin}/api/ton/info`];

      for (const p of paths) {
        try {
          const res = await fetch(p, { credentials: "same-origin" });
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`HTTP ${res.status} - ${text}`);
          }
          const json = await res.json().catch(() => null);
          if (!mounted) return;
          setTonInfo(json);
          return;
        } catch (e: any) {
          console.warn("fetch ton info failed for", p, e?.message || e);
          if (p === paths[paths.length - 1]) setError(String(e?.message || e));
        }
      }
    }

    loadTonInfo();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(217,33%,9%)] text-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold">Make</h1>
        <WalletGate>
          <p className="mt-2 text-white/70">
            Create gigs or proposals powered by TON. Draft your offer, set
            milestones, and publish securely.
          </p>
          <Link
            to="/offer/new"
            className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create a New Offer
          </Link>
        </WalletGate>

        {error && (
          <div className="mt-6 rounded-xl border border-red-600 bg-red-900/30 p-4 text-red-200 text-xs">
            Failed to load TON info: {error}
          </div>
        )}

        {tonInfo?.ok && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
            <div className="mb-2 font-semibold text-white">TON Chain Info</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <div className="text-white/60">Source</div>
                <div className="font-mono break-all">
                  {tonInfo.url || "n/a"}
                </div>
              </div>
              <div>
                <div className="text-white/60">Version</div>
                <div className="font-mono">
                  {tonInfo?.data?.["8"]?.version ?? "n/a"}
                </div>
              </div>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-white/80 hover:text-white">
                Full JSON
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(tonInfo.data, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
