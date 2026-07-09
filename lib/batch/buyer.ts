// lib/batch/buyer.ts
import { Wallet } from "ethers";
import { buyNoxaTokenProtected } from "../dex/swap";
import { getQuote } from "../dex/quoter";

export interface BuyResult {
  address: string;
  status: "success" | "failed";
  txHash?: string;
  error?: string;
}

export interface WalletAmount {
  wallet: Wallet;
  ethAmount: string; // exact amount for this specific wallet, e.g. from planSequentialBuys
}

// Fires all buy transactions concurrently — each wallet has its own key, so
// there's no nonce coupling and no wallet-approval popups to serialize on.
// An optional random delay is applied before each send (not after waiting for
// the previous one) to preserve natural staggering without blocking on
// confirmation time. Pass delayMsBetween=[0,0] or omit it for true simultaneous sends.
export async function multiBuyVariable(
  items: WalletAmount[],
  tokenAddress: string,
  slippageBps = 500,
  delayMsBetween?: [number, number],
  onProgress?: (result: BuyResult) => void
): Promise<BuyResult[]> {
  const outcomes = await Promise.allSettled(
    items.map(async ({ wallet, ethAmount }) => {
      if (delayMsBetween) {
        const [min, max] = delayMsBetween;
        const jitter = min + Math.random() * (max - min);
        await new Promise((r) => setTimeout(r, jitter));
      }
      const receipt = await buyNoxaTokenProtected({
        wallet,
        tokenAddress,
        ethAmount,
        slippageBps,
      });
      return { address: wallet.address, status: "success" as const, txHash: receipt?.hash };
    })
  );

  const results: BuyResult[] = outcomes.map((outcome, i) => {
    const result: BuyResult =
      outcome.status === "fulfilled"
        ? outcome.value
        : { address: items[i].wallet.address, status: "failed", error: outcome.reason?.message ?? String(outcome.reason) };
    onProgress?.(result);
    return result;
  });

  return results;
}

// Kept for the manual Multi Buyer page, where a flat amount is a
// deliberate user choice rather than a curve-derived plan.
export async function multiBuy(/* ...unchanged from before... */) {
  // existing implementation stays as-is
}
