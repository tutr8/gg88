import {
  TonConnectButton,
  TonConnectUIProvider,
  useTonWallet,
} from "@tonconnect/ui-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import BottomNav from "./BottomNav";
import { useTelegramPlatform } from "@/hooks/useTma";
import { useTelegramBackButton } from "@/hooks/useTmaBackButton";

function UpsertOnConnect() {
  const wallet = useTonWallet();
  useEffect(() => {
    let mounted = true;
    let t: any = null;
    const address = wallet?.account?.address;

    // Debounce and guard against spurious connect/disconnect events from extensions
    if (address) {
      t = setTimeout(async () => {
        if (!mounted) return;
        try {
          // call server to upsert user, but don't allow exceptions to bubble
          const { apiUrl } = await import("@/lib/api");
          await fetch(apiUrl("/api/users/upsert"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
          });
        } catch (e) {
          // ignore network/extension messaging errors
          console.warn("UpsertOnConnect failed:", e);
        }
      }, 400);
    }

    return () => {
      mounted = false;
      if (t) clearTimeout(t);
    };
  }, [wallet?.account?.address]);
  return null;
}

export default function Header({ children }: { children?: React.ReactNode }) {
  const manifestUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tonconnect-manifest.json`
      : "/tonconnect-manifest.json";

  const { isAndroid } = useTelegramPlatform();
  const topOffsetClass = isAndroid ? "mt-[69px] sm:mt-[60px]" : "mt-0";

  const location = useLocation();
  const navigate = useNavigate();
  const showBack = useMemo(
    () => location.pathname !== "/",
    [location.pathname],
  );
  useTelegramBackButton(showBack, () => {
    if (typeof window !== "undefined" && window.history.length > 1)
      navigate(-1);
    else navigate("/");
  });

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <UpsertOnConnect />
      <div className="flex min-h-dvh flex-col bg-[hsl(217,33%,9%)] text-white">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[hsl(217,33%,9%)]/80 backdrop-blur">
          <div
            className={`mx-auto ${topOffsetClass} flex h-14 w-full max-w-5xl items-center justify-between px-4`}
          >
            <Link
              to="/"
              className="text-sm font-semibold text-white/80 hover:text-white"
            >
              FreelTON
            </Link>
            <div className="w-fit">
              <TonConnectButton className="[&_*]:!font-medium" />
            </div>
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
        <footer className="mt-auto">
          <BottomNav />
        </footer>
      </div>
    </TonConnectUIProvider>
  );
}
