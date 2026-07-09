// components/scanner/SellStrategyForm.tsx
"use client";
import { SellStrategy, SellTrigger } from "@/lib/rules/types";

export function SellStrategyForm({
  strategy,
  onChange,
}: {
  strategy: SellStrategy;
  onChange: (s: SellStrategy) => void;
}) {
  const updateTrigger = (id: string, field: keyof SellTrigger, value: number) => {
    onChange({
      triggers: strategy.triggers.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    });
  };

  const labelFor = (t: SellTrigger) => {
    switch (t.type) {
      case "take_profit_mc_multiple": return `Take profit at ${t.value}x`;
      case "stop_loss_mc_drop_pct": return `Stop loss at -${t.value}%`;
      case "trailing_stop_pct": return `Trailing stop -${t.value}% from peak`;
      case "graduation_reached": return `Graduation MC $${t.value}`;
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-medium mb-3">Sell Strategy</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-400">
            <th className="py-1">Trigger</th>
            <th>Value</th>
            <th>Exit %</th>
          </tr>
        </thead>
        <tbody>
          {strategy.triggers.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="py-2">{labelFor(t)}</td>
              <td>
                <input
                  type="number"
                  value={t.value}
                  onChange={(e) => updateTrigger(t.id, "value", Number(e.target.value))}
                  className="border rounded px-2 py-1 w-20"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={t.exitPercentage}
                  onChange={(e) => updateTrigger(t.id, "exitPercentage", Number(e.target.value))}
                  className="border rounded px-2 py-1 w-20"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
