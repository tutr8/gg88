import WalletGate from "@/components/WalletGate";
import { useWalletAddress } from "@/hooks/useTon";

export default function Profile() {
  const address = useWalletAddress();

  return (
    <div className="min-h-[calc(100dvh-160px)] bg-[hsl(217,33%,9%)] text-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold">Profile</h1>
        <WalletGate>
          <p className="mt-2 text-white/70">
            Manage your identity, skills, and past work. Connect a TON wallet to
            get paid.
          </p>

          <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div>
              <div className="text-xs text-white/60">
                Wallet Address (friendly)
              </div>
              <div className="font-mono break-all text-sm">
                {address || "Not connected"}
              </div>
            </div>

            <div>
              <div className="text-xs text-white/60">Nickname</div>
              <div className="font-mono break-all text-sm">
                {address || "Not connected"}
              </div>
            </div>
          </div>
        </WalletGate>
      </div>
    </div>
  );
}
