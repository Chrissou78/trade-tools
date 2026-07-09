// lib/dex/simulateLoadPlan.ts
import { JsonRpcProvider } from "ethers";
import { discoverTokenLimits } from "./tokenLimits";
import { getEthNeededForExactTokens } from "./quoter";

export interface WalletLoadPlan {
  walletIndex: number;
  targetTokens: string;      // human-readable, formatted by decimals
  ethToLoad: string;         // ETH amount to send this wallet, formatted
  ethToLoadWei: bigint;      // raw wei, for actually sending
  priceImpactWarning: boolean;
  cumulativeEthSoFar: string;
}

export interface LoadPlanResult {
  tokenAddress: string;
  maxWalletTokensRaw: bigint;
  decimals: number;
  perWalletTargetPct: number;
  wallets: WalletLoadPlan[];
  totalEthNeeded: string;
  warnings: string[];
}

/**
 * Simulates buying up to `targetPctOfCap` of the max-wallet limit,
 * sequentially, across `walletCount` wallets — exactly mirroring the
 * order the real multi-buy will execute in. Each wallet's quote is
 * computed against the pool state AFTER the previous wallet's
 * hypothetical buy, since that's what will actually happen on-chain.
 *
 * Output: exact ETH amount to pre-fund each wallet with.
 */
export async function simulateLoadPlan(
  provider: JsonRpcProvider,
  tokenAddress: string,
  walletCount: number,
  targetPctOfCap = 0.96,
  feeTier = 10000
): Promise<LoadPlanResult> {
  const limits = await discoverTokenLimits(provider, tokenAddress);
  if (!limits.maxWalletTokens) {
    throw new Error(
      "Could not read max-wallet limit from contract. Verify the token address and check its ABI on Blockscout before proceeding."
    );
  }

  const targetPerWallet = BigInt(
    Math.floor(Number(limits.maxWalletTokens) * targetPctOfCap)
  );

  const wallets: WalletLoadPlan[] = [];
  const warnings: string[] = [];
  let cumulativeEth = 0n;

  // NOTE: this walks the curve sequentially using LIVE pool state for
  // wallet 0, but for wallets 1..N it re-quotes against the *current*
  // real pool state each call — it does NOT simulate wallet 0's buy
  // actually landing first. See caveat below the code.
  for (let i = 0; i < walletCount; i++) {
    const { ethNeeded, priceImpactWarning } = await getEthNeededForExactTokens(
      provider,
      tokenAddress,
      targetPerWallet,
      feeTier
    );

    if (priceImpactWarning) {
      warnings.push(
        `Wallet ${i}: pool curve is steep at this size — actual execution may deviate meaningfully from quote.`
      );
    }

    cumulativeEth += ethNeeded;

    wallets.push({
      walletIndex: i,
      targetTokens: (Number(targetPerWallet) / 10 ** limits.decimals).toString(),
      ethToLoad: (Number(ethNeeded) / 1e18).toFixed(6),
      ethToLoadWei: ethNeeded,
      priceImpactWarning,
      cumulativeEthSoFar: (Number(cumulativeEth) / 1e18).toFixed(6),
    });
  }

  return {
    tokenAddress,
    maxWalletTokensRaw: limits.maxWalletTokens,
    decimals: limits.decimals,
    perWalletTargetPct: targetPctOfCap * 100,
    wallets,
    totalEthNeeded: (Number(cumulativeEth) / 1e18).toFixed(6),
    warnings,
  };
}
