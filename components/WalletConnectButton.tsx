// components/WalletConnectButton.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { BrowserProvider, formatEther } from "ethers";
import { ensureRobinhoodChain } from "@/lib/chains/robinhood";
import { getMetaMaskProvider } from "@/lib/wallets/metamaskProvider";
import { copyToClipboard } from "@/lib/ui/clipboard";

export function WalletConnectButton({
  onConnected,
  onDisconnected,
}: {
  onConnected?: (address: string, signerProvider: BrowserProvider) => void;
  onDisconnected?: () => void;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const providerRef = useRef<BrowserProvider | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const refreshBalance = async (addr: string, provider: BrowserProvider) => {
    try {
      const bal = await provider.getBalance(addr);
      setBalance(formatEther(bal));
    } catch {
      setBalance(null);
    }
  };

  // On mount, if MetaMask already has a connected account (e.g. after a
  // page reload), silently restore the full BrowserProvider and fire
  // onConnected — previously this only restored the displayed address,
  // leaving the parent page's signer state stuck at null.
  useEffect(() => {
    (async () => {
      try {
        const injected = await getMetaMaskProvider();
        const accounts: string[] = await injected.request({ method: "eth_accounts" });
        if (accounts[0]) {
          const provider = new BrowserProvider(injected);
          providerRef.current = provider;
          setAddress(accounts[0]);
          await refreshBalance(accounts[0], provider);
          onConnected?.(accounts[0], provider);
        }
      } catch {
        // no injected provider yet, or user hasn't connected — fine, wait for click
      }
    })();
  }, []);

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const connect = async () => {
    setConnecting(true);
    setError("");
    try {
      const injected = await getMetaMaskProvider();
      await ensureRobinhoodChain(injected);
      const provider = new BrowserProvider(injected);
      const accounts = await provider.send("eth_requestAccounts", []);
      providerRef.current = provider;
      setAddress(accounts[0]);
      await refreshBalance(accounts[0], provider);
      onConnected?.(accounts[0], provider);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  // This clears local UI/app state only — MetaMask itself doesn't expose
  // a true programmatic disconnect, the user would need to disconnect
  // the site from within the MetaMask extension for a full revoke.
  const disconnect = () => {
    setAddress(null);
    setBalance(null);
    providerRef.current = null;
    setMenuOpen(false);
    onDisconnected?.();
  };

  if (!address) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={connect}
          disabled={connecting}
          className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-100 text-sm font-medium hover:bg-zinc-800 transition"
        >
          {connecting ? "Connecting..." : "Connect MetaMask"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-100 text-sm font-medium hover:bg-zinc-800 transition flex items-center gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg p-3 z-50 text-sm">
          <div className="text-xs text-zinc-400 mb-1">Connected wallet</div>
          <div className="font-mono text-xs text-zinc-100 break-all mb-2">{address}</div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-400 text-xs">Balance</span>
            <span className="text-zinc-100 font-medium">{balance ? `${Number(balance).toFixed(4)} ETH` : "..."}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => { if (await copyToClipboard(address)) { setCopied(true); setTimeout(() => setCopied(false), 1200); } }}
              className="flex-1 px-3 py-1.5 border border-zinc-700 rounded-lg text-zinc-100 hover:bg-zinc-800 text-xs"
            >
              {copied ? "Copied!" : "Copy Address"}
            </button>
            <button
              onClick={() => providerRef.current && refreshBalance(address, providerRef.current)}
              className="px-3 py-1.5 border border-zinc-700 rounded-lg text-zinc-100 hover:bg-zinc-800 text-xs"
            >
              ↻
            </button>
          </div>
          <button
            onClick={disconnect}
            className="w-full mt-2 px-3 py-1.5 border border-red-800 text-red-300 rounded-lg hover:bg-red-950/50 text-xs"
          >
            Disconnect (this app only)
          </button>
        </div>
      )}
    </div>
  );
}
