// app/launch/sections/SellSection.tsx
"use client";
import { Target } from "lucide-react";
import { GeneratedWallet } from "@/lib/wallets/generator";
import { StepCard, Input, Button, Toggle, AddressChip } from "@/components/ui";
import type { WalletSellConfig } from "../types";

interface Props {
  wallets: GeneratedWallet[];
  sellConfig: Record<string, WalletSellConfig>;
  onSellConfigChange: (address: string, cfg: WalletSellConfig) => void;
  onSellWallet: (address: string, privateKey: string) => void;
}

const DEFAULT_CFG: WalletSellConfig = { sellPct: 100, gainThreshold: 2, autoSell: false };

export function SellSection({ wallets, sellConfig, onSellConfigChange, onSellWallet }: Props) {
  return (
    <div className="mb-20"><StepCard step={5} title="Sell Per Wallet" description="Auto-sell polls every 5s once current MC ≥ entry MC × threshold">
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-base">
          <thead>
            <tr className="text-left text-sm uppercase tracking-wider text-zinc-500 bg-white/[0.04]">
              <th className="py-4 px-5 font-medium">Wallet</th>
              <th className="py-4 px-5 font-medium">Sell %</th>
              <th className="py-4 px-5 font-medium">Sell at (x entry)</th>
              <th className="py-4 px-5 font-medium">Auto</th>
              <th className="py-4 px-5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {wallets.map((w) => {
              const cfg = sellConfig[w.address] ?? DEFAULT_CFG;
              return (
                <tr key={w.address} className="hover:bg-white/[0.03] transition">
                  <td className="py-4 px-5"><AddressChip address={w.address} /></td>
                  <td className="py-4 px-5">
                    <Input
                      compact type="number" value={cfg.sellPct}
                      onChange={(e) => onSellConfigChange(w.address, { ...cfg, sellPct: Number(e.target.value) })}
                      className="w-24"
                    />
                  </td>
                  <td className="py-4 px-5">
                    <Input
                      compact type="number" step="0.1" value={cfg.gainThreshold}
                      onChange={(e) => onSellConfigChange(w.address, { ...cfg, gainThreshold: Number(e.target.value) })}
                      className="w-24"
                    />
                  </td>
                  <td className="py-4 px-5">
                    <Toggle checked={cfg.autoSell} onChange={(v) => onSellConfigChange(w.address, { ...cfg, autoSell: v })} />
                  </td>
                  <td className="py-4 px-5">
                    <Button variant="secondary" onClick={() => onSellWallet(w.address, w.privateKey)}>
                      <Target className="h-4 w-4" /> Sell Now
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </StepCard></div>
  );
}
