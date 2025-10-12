import { useTonWallet } from "@tonconnect/ui-react";

export function useIsWalletConnected() {
  const wallet = useTonWallet();
  return Boolean(wallet && wallet.account);
}

export function useWalletAddress() {
  const wallet = useTonWallet();
  return wallet?.account?.address;
}
