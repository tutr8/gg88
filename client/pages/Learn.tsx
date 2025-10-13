export default function Learn() {
  return (
    <div className="min-h-[calc(100dvh-160px)] bg-[hsl(217,33%,9%)] text-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold">Learn</h1>
        <p className="mt-2 text-white/70">
          Guides and tips on using TON for freelance: wallets, escrows, and best
          practices.
        </p>

        <div className="mt-6 grid gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="font-semibold">Getting Started with TON</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
              <li>
                Create a wallet (Tonkeeper/Tonhub) and back up the seed phrase.
              </li>
              <li>Connect your wallet using the button in the header.</li>
              <li>Fund your wallet with a small amount of TON for fees.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="font-semibold">Safe Collaboration</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
              <li>Use clear deliverables and milestones.</li>
              <li>Agree on payment and timelines before starting.</li>
              <li>Keep communication in writing to resolve disputes.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="font-semibold">Best Practices</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
              <li>Start with small tasks to build reputation.</li>
              <li>Write clear job descriptions and include scope.</li>
              <li>Request reviews after successful completion.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
