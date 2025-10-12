import { ReactNode } from "react";
import { useIsWalletConnected } from "@/hooks/useTon";

export default function WalletGate({
  children,
  message = "Please connect your TON wallet",
}: {
  children: ReactNode;
  message?: string;
}) {
  const connected = useIsWalletConnected();
  return (
    <div>
      {!connected && (
        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80">
          {message}
        </div>
      )}
      <div
        aria-disabled={!connected}
        className={!connected ? "pointer-events-none opacity-50" : undefined}
      >
        {children}
      </div>
    </div>
  );
}
