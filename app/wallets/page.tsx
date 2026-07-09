// app/wallets/page.tsx
"use client";
import { useState } from "react";
import { generateWallets, GeneratedWallet } from "@/lib/wallets/generator";
import { saveWalletsEncrypted, loadWalletsEncrypted } from "@/lib/wallets/storage";
import { WalletConnectButton } from "@/components/WalletConnectButton";

export default function WalletsPage() {
  const [count, setCount] = useState(5);
  const [password, setPassword] = useState("");
  const [wallets, setWallets] = useState<GeneratedWallet[]>([]);
  const [status, setStatus] = useState("");

  const handleGenerate = () => {
    const generated = generateWallets(count);
    setWallets(generated);
    setStatus(`Generated ${generated.length} wallets. Save them before leaving this page.`);
  };

  const handleSave = async () => {
    if (!password) return setStatus("Set a password first.");
    await saveWalletsEncrypted(wallets, password);
    setStatus("Wallets encrypted and saved to local storage.");
  };

  const handleLoad = async () => {
    if (!password) return setStatus("Enter the password used to save.");
    const loaded = await loadWalletsEncrypted(password);
    if (!loaded) return setStatus("No saved wallets found.");
    setWallets(loaded);
    setStatus(`Loaded ${loaded.length} wallets.`);
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-semibold">Multi Wallet Generator</h1>
        <WalletConnectButton />
      </div>

      <div className="flex gap-3 mb-4 items-end">
        <div>
          <label className="block text-sm text-zinc-500 mb-1">Wallet count</label>
          <input type="number" value={count} onChange={(e) => setCount(Number(e.target.value))} className="border rounded px-3 py-2 w-24" />
        </div>
        <div>
          <label className="block text-sm text-zinc-500 mb-1">Encryption password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="border rounded px-3 py-2" />
        </div>
        <button onClick={handleGenerate} className="px-4 py-2 bg-black text-white rounded">Generate</button>
        <button onClick={handleSave} className="px-4 py-2 border rounded">Save (encrypted)</button>
        <button onClick={handleLoad} className="px-4 py-2 border rounded">Load</button>
      </div>

      {status && <p className="text-sm text-zinc-500 mb-4">{status}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-400 border-b">
            <th className="py-2">#</th>
            <th>Address</th>
            <th>Private Key (session only)</th>
          </tr>
        </thead>
        <tbody>
          {wallets.map((w) => (
            <tr key={w.index} className="border-b">
              <td className="py-2">{w.index}</td>
              <td className="font-mono">{w.address}</td>
              <td className="font-mono text-zinc-400">{w.privateKey.slice(0, 10)}...</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
