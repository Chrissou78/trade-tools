// lib/dex/maxWalletBuy.ts
import { JsonRpcProvider, Wallet, formatEther } from "ethers";
import { discoverTokenLimits } from "./tokenLimits";
import { getEthNeededForExactTokens } from "./quoter";
import { buyNoxaTokenProtected } from "./swap";

export interface MaxWalletBuyPlan {
  targetTokens: bigint;
  ethRequired: bigint;
  ethRequiredFormatted: string;
  priceImpactWarning: boolean;
  capUsedPct: number;
}

export async function planMaxWalletBuy(
  provider: JsonRpcProvider,
  tokenAddress: string,
  existingBalance: bigint = 0n,
  targetPctOfCap = 0.96, // aim just under the cap, not exactly on it
  feeTier = 10000
): Promise<MaxWalletBuyPlan> {
  const limits = await discoverTokenLimits(provider, tokenAddress);
  if (!limits.maxWalletTokens) {
    throw new Error(
      "Could not read max-wallet limit from contract — check verified source on explorer and hardcode the correct getter."
    );
  }

  const headroom = limits.maxWalletTokens - existingBalance;
  if (headroom <= 0n) throw new Error("Wallet already at or above max-wallet cap.");

  const targetTokens = BigInt(Math.floor(Number(headroom) * targetPctOfCap));

  const { ethNeeded, priceImpactWarning } = await getEthNeededForExactTokens(
    provider,
    tokenAddress,
    targetTokens,
    feeTier
  );

  return {
    targetTokens,
    ethRequired: ethNeeded,
    ethRequiredFormatted: formatEther(ethNeeded),
    priceImpactWarning,
    capUsedPct: targetPctOfCap * 100,
  };
}

// Execute the plan with a fresh re-quote immediately before sending,
// since pool state may have shifted since planMaxWalletBuy() ran.
export async function executeMaxWalletBuy(
  wallet: Wallet,
  tokenAddress: string,
  plan: MaxWalletBuyPlan,
  slippageBps = 300
) {
  return buyNoxaTokenProtected({
    wallet,
    tokenAddress,
    ethAmount: plan.ethRequiredFormatted,
    slippageBps,
  });
}
