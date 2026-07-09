// components/scanner/PositionsTable.tsx
"use client";
import { Position } from "@/lib/rules/types";

export function PositionsTable({ positions }: { positions: Position[] }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wide">Open Positions</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-400 border-b">
            <th className="py-2">Token</th><th>Entry MC</th><th>Peak MC</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.tokenAddress} className="border-b">
              <td className="py-2 font-mono">{p.tokenAddress.slice(0, 8)}...</td>
              <td>${p.entryMcUsd.toFixed(0)}</td>
              <td>${p.peakMcUsd.toFixed(0)}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
