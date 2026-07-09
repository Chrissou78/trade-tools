// components/WalletConnectButton.tsx
"use client";
import { useState, useEffect } from "react";
import { BrowserProvider } from "ethers";
import { ensureRobinhoodChain } from "@/lib/chains/robinhood";
import { getMetaMaskProvider } from "@/lib/wallets/metamaskProvider";

export function WalletConnectButton({ onConnected }: { onConnected?: (address: string, signerProvider: BrowserProvider) => void }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMetaMaskProvider()
      .then((p) => p.request({ method: "eth_accounts" }))
      .then((accounts: string[]) => { if (accounts[0]) setAddress(accounts[0]); })
      .catch(() => {});
  }, []);

  const connect = async () => {
    setConnecting(true);
    setError("");
    try {
      const injected = await getMetaMaskProvider();
      await ensureRobinhoodChain(injected);
      const provider = new BrowserProvider(injected);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0]);
      onConnected?.(accounts[0], provider);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={connect}
        disabled={connecting}
        className="px-4 py-2 rounded-lg border border-zinc-300 text-sm font-medium hover:bg-zinc-50 transition"
      >
        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : connecting ? "Connecting..." : "Connect MetaMask"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
