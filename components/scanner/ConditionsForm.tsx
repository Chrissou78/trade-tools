// components/scanner/ConditionsForm.tsx
"use client";
import { EntryConditions } from "@/lib/rules/types";

export function ConditionsForm({ conditions, onChange }: { conditions: EntryConditions; onChange: (c: EntryConditions) => void }) {
  const update = (key: keyof EntryConditions, value: number | boolean) => onChange({ ...conditions, [key]: value });

  return (
    <div className="grid grid-cols-2 gap-4 mb-6 p-4 border rounded-lg">
      <Field label="Max MC after first buy ($)" value={conditions.maxMarketCapAfterFirstBuyUsd} onChange={(v) => update("maxMarketCapAfterFirstBuyUsd", v)} />
      <Field label="Min liquidity (L)" value={conditions.minLiquidity} onChange={(v) => update("minLiquidity", v)} />
      <Field label="Target % of max-wallet cap" value={conditions.maxWalletBuyPctOfCap} step={0.01} onChange={(v) => update("maxWalletBuyPctOfCap", v)} />
      <Field label="Wallet count per launch" value={conditions.walletCount} onChange={(v) => update("walletCount", v)} />
      <Field label="Total ETH budget cap" value={conditions.ethBudgetCapTotal} step={0.01} onChange={(v) => update("ethBudgetCapTotal", v)} />
    </div>
  );
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="block text-sm text-zinc-500 mb-1">{label}</label>
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="border rounded px-3 py-2 w-full" />
    </div>
  );
}
