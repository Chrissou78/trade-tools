// app/launch/sections/FundBuySection.tsx
"use client";
import { Rocket, Layers } from "lucide-react";
import { StepCard, Field, Input, Button } from "@/components/ui";

interface Props {
  tokenAddress: string;
  onTokenAddressChange: (v: string) => void;
  // Manual common-value controls: one ETH amount applied to every wallet.
  commonBuyEth: number;
  onCommonBuyEthChange: (n: number) => void;
  onApplyCommon: () => void;
  walletCount: number;
  onFund: () => void;
  onBuy: () => void;
}

export function FundBuySection({
  tokenAddress, onTokenAddressChange,
  commonBuyEth, onCommonBuyEthChange, onApplyCommon, walletCount,
  onFund, onBuy,
}: Props) {
  const total = commonBuyEth > 0 && walletCount > 0 ? commonBuyEth * walletCount : 0;

  return (
    <div className="mb-20"><StepCard step={3} title="Fund & Buy" description="Funding source: connected MetaMask wallet">
      <Field label="Token address (required to buy)">
        <Input placeholder="0x…" value={tokenAddress} onChange={(e) => onTokenAddressChange(e.target.value)} className="w-full font-mono" />
      </Field>

      {/* Manual common value: load the same ETH amount into every wallet, */}
      {/* overriding the simulated per-wallet plan. */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-end">
          <Field label="Same buy amount for every wallet (ETH)">
            <Input
              type="number"
              step="0.001"
              min="0"
              value={commonBuyEth}
              onChange={(e) => onCommonBuyEthChange(Number(e.target.value))}
              className="w-full"
            />
          </Field>
          <Button variant="secondary" onClick={onApplyCommon}>
            <Layers className="h-5 w-5" /> Apply to all wallets
          </Button>
        </div>
        <p className="text-sm text-zinc-500 leading-relaxed">
          This overwrites the simulated plan. Every one of your {walletCount || 0} wallet(s) will buy{" "}
          {commonBuyEth > 0 ? `${commonBuyEth} ETH` : "the amount above"}
          {total > 0 ? `, for a total of ${total.toFixed(4)} ETH` : ""}. Fund and buy then use this flat amount.
        </p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Button variant="secondary" onClick={onFund}>Fund Wallets (+3% margin)</Button>
        <Button variant="primary" onClick={onBuy}><Rocket className="h-5 w-5" /> Execute Buys</Button>
      </div>
    </StepCard></div>
  );
}
