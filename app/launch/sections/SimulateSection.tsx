// app/launch/sections/SimulateSection.tsx
"use client";
import { LineChart } from "lucide-react";
import { GeneratedWallet } from "@/lib/wallets/generator";
import { StepCard, Field, Input, Button, StatBox, AddressChip } from "@/components/ui";
import type { SimMode, PlanStep, EmpiricalStats } from "../types";

interface Props {
  simMode: SimMode;
  onSimModeChange: (m: SimMode) => void;
  ownerBuyEth: number;
  onOwnerBuyEthChange: (n: number) => void;
  liquidityL: number;
  onLiquidityLChange: (n: number) => void;
  tokenAddress: string;
  onTokenAddressChange: (v: string) => void;
  onSimulateEmpirical: () => void;
  onSimulateLive: () => void;
  empiricalStats: EmpiricalStats | null;
  plan: PlanStep[] | null;
  wallets: GeneratedWallet[];
}

export function SimulateSection({
  simMode, onSimModeChange, ownerBuyEth, onOwnerBuyEthChange, liquidityL, onLiquidityLChange,
  tokenAddress, onTokenAddressChange, onSimulateEmpirical, onSimulateLive, empiricalStats, plan, wallets,
}: Props) {
  return (
    <div className="mb-20"><StepCard
      step={2}
      title="Simulate"
      description="Model market cap and per-wallet buy sizes before spending anything"
      actions={
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1.5">
          <button
            onClick={() => onSimModeChange("empirical")}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition ${simMode === "empirical" ? "bg-brand text-black" : "text-zinc-400 hover:text-brand-goldLight"}`}
          >
            Empirical
          </button>
          <button
            onClick={() => onSimModeChange("live")}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition ${simMode === "live" ? "bg-brand text-black" : "text-zinc-400 hover:text-brand-goldLight"}`}
          >
            Live (on-chain)
          </button>
        </div>
      }
    >
      {simMode === "empirical" ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
          <Field label="Owner's first buy (ETH)">
            <Input type="number" step="0.01" value={ownerBuyEth} onChange={(e) => onOwnerBuyEthChange(Number(e.target.value))} className="w-full" />
          </Field>
          <Field label="Liquidity estimate (L)">
            <Input type="number" value={liquidityL} onChange={(e) => onLiquidityLChange(Number(e.target.value))} className="w-full" />
          </Field>
          <Button variant="primary" onClick={onSimulateEmpirical} className="h-14"><LineChart className="h-5 w-5" /> Simulate</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-end">
          <Field label="Token address">
            <Input placeholder="0x…" value={tokenAddress} onChange={(e) => onTokenAddressChange(e.target.value)} className="w-full font-mono" />
          </Field>
          <Button variant="primary" onClick={onSimulateLive}><LineChart className="h-5 w-5" /> Simulate</Button>
        </div>
      )}

      {empiricalStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatBox label="Floor MC (pre-buy)" value={`$${empiricalStats.floorMcUsd.toFixed(0)}`} />
          <StatBox label="MC after owner buy" value={`$${empiricalStats.afterOwnerBuyMcUsd.toFixed(0)}`} tone="brand" />
          <StatBox label="Owner bought" value={`${empiricalStats.pctOfSupplyOwnerBought.toFixed(2)}%`} sub="of supply" />
          <StatBox
            label="Reserves (ETH / tok)"
            value={`${empiricalStats.ethReserveAfterOwnerBuy.toFixed(2)} / ${empiricalStats.tokenReserveAfterOwnerBuy.toFixed(0)}`}
          />
        </div>
      )}

      {plan && (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-base">
            <thead>
              <tr className="text-left text-sm uppercase tracking-wider text-zinc-500 bg-white/[0.04]">
                <th className="py-4 px-5 font-medium">Wallet</th>
                <th className="py-4 px-5 font-medium">ETH to send</th>
                <th className="py-4 px-5 font-medium">MC after buy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {plan.map((s) => (
                <tr key={s.walletIndex} className="hover:bg-white/[0.03] transition">
                  <td className="py-4 px-5">
                    {wallets[s.walletIndex]?.address ? <AddressChip address={wallets[s.walletIndex].address} /> : <span className="text-zinc-400">#{s.walletIndex}</span>}
                  </td>
                  <td className="py-4 px-5 text-brand-goldLight font-mono">{s.ethGrossToSend.toFixed(5)} ETH</td>
                  <td className="py-4 px-5 text-zinc-400">{s.mcAfterUsd > 0 ? `$${s.mcAfterUsd.toFixed(0)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StepCard></div>
  );
}
