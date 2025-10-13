import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import WalletGate from "@/components/WalletGate";
import { useIsWalletConnected, useWalletAddress } from "@/hooks/useTon";

export default function CreateOffer() {
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("0.1");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [stack, setStack] = useState("");
  const navigate = useNavigate();
  const connected = useIsWalletConnected();
  const address = useWalletAddress();

  useEffect(() => {
    if (connected && address) {
      fetch(apiUrl("/api/users/upsert"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      }).catch(console.error);
    }
  }, [connected, address]);

  async function submit() {
    if (!connected) {
      alert("Please connect your TON wallet");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/offers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          budgetTON: Number(budget),
          stack,
          makerAddress: address,
        }),
      });
      if (!r.ok) throw new Error("Failed to create offer");
      navigate("/take");
    } catch (e) {
      console.error(e);
      alert("Failed to create offer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100dvh-160px)] bg-[hsl(217,33%,9%)] text-white">
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-6">
        <h1 className="text-3xl font-bold">Create a New Offer</h1>
        <WalletGate>
          <p className="mt-2 text-white/70">
            Define the title and budget in TON. Escrow and on-chain actions
            подключим позже.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-white/70">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Landing page design"
                className="bg-white/5 text-white border-white/10"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the scope, deliverables, and milestones"
                className="min-h-28 w-full rounded-md bg-white/5 text-white border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-white/70">Stack</label>
              <Input
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                placeholder="e.g. React, Node.js, TON"
                className="bg-white/5 text-white border-white/10"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Budget (TON)
              </label>
              <Input
                type="number"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="bg-white/5 text-white border-white/10"
              />
            </div>
            <Button
              onClick={submit}
              disabled={loading || !title}
              className="bg-primary text-primary-foreground"
            >
              {loading ? "Creating..." : "Create Offer"}
            </Button>
            <div className="text-xs text-white/50">
              All fields can be edited later.
            </div>
          </div>
        </WalletGate>
      </div>
    </div>
  );
}
