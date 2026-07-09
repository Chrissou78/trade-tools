// components/WalletConnectButton.tsx
"use client";
import { useState, useEffect } from "react";
import { BrowserProvider } from "ethers";
import { ensureRobinhoodChain } from "@/lib/chains/robinhood";

export function WalletConnectButton({ onConnected }: { onConnected?: (address: string) => void }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    (window as any).ethereum?.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      if (accounts[0]) setAddress(accounts[0]);
    });
  }, []);

  const connect = async () => {
    if (!(window as any).ethereum) {
      alert("MetaMask not detected.");
      return;
    }
    setConnecting(true);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      await ensureRobinhoodChain((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0]);
      onConnected?.(accounts[0]);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <button onClick={connect} disabled={connecting} className="px-4 py-2 rounded-md border text-sm font-medium">
      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : connecting ? "Connecting..." : "Connect MetaMask"}
    </button>
  );
}
