// components/scanner/LaunchFeed.tsx
"use client";
import { ScannedLaunch } from "@/hooks/useNoxaScanner";
import { EntryConditions } from "@/lib/rules/types";
import { evaluateEntry } from "@/lib/rules/evaluator";

export function LaunchFeed({ launches, conditions }: { launches: ScannedLaunch[]; conditions: EntryConditions }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wide">Detected Launches</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-400 border-b">
            <th className="py-2">Token</th><th>MC after buy</th><th>Liquidity</th><th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {launches.map((l) => {
            const verdict = l.mcAfterFirstBuyUsd != null && l.liquidity != null
              ? evaluateEntry(conditions, l.mcAfterFirstBuyUsd, l.liquidity)
              : null;
            return (
              <tr key={l.txHash} className="border-b">
                <td className="py-2 font-mono">{l.tokenAddress.slice(0, 8)}...</td>
                <td>{l.mcAfterFirstBuyUsd ? `$${l.mcAfterFirstBuyUsd.toFixed(0)}` : "resolving..."}</td>
                <td>{l.liquidity ? l.liquidity.toFixed(0) : "-"}</td>
                <td className={verdict?.shouldEnter ? "text-green-600" : "text-zinc-400"}>
                  {verdict ? verdict.reason : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
