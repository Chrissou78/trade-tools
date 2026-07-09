// components/scanner/WalletPoolUnlock.tsx
"use client";
import { useState } from "react";

export function WalletPoolUnlock({
  onUnlock, isUnlocked, poolSize,
}: { onUnlock: (password: string) => Promise<void>; isUnlocked: boolean; poolSize: number }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleUnlock = async () => {
    setError("");
    try {
      await onUnlock(password);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isUnlocked) {
    return (
      <div className="mb-6 p-3 border rounded-lg text-sm text-green-600">
        Wallet pool unlocked — {poolSize} wallets available for auto-execution.
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 border rounded-lg">
      <p className="text-sm text-zinc-500 mb-2">
        Unlock your generated wallet pool (from the Multi Wallet Generator page) to allow auto-execution.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Wallet pool password"
          className="border rounded px-3 py-2 flex-1"
        />
        <button onClick={handleUnlock} className="px-4 py-2 bg-black text-white rounded">Unlock</button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
