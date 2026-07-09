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

// New: takes a precise per-wallet amount array instead of one flat amount.
// This is what executeEntry should call now, using `plan` directly.
export async function multiBuyVariable(
  items: WalletAmount[],
  tokenAddress: string,
  slippageBps = 500,
  delayMsBetween?: [number, number],
  onProgress?: (result: BuyResult) => void
): Promise<BuyResult[]> {
  const results: BuyResult[] = [];

  for (const { wallet, ethAmount } of items) {
    try {
      const receipt = await buyNoxaTokenProtected({
        wallet,
        tokenAddress,
        ethAmount,
        slippageBps,
      });
      const result: BuyResult = { address: wallet.address, status: "success", txHash: receipt?.hash };
      results.push(result);
      onProgress?.(result);
    } catch (err: any) {
      const result: BuyResult = { address: wallet.address, status: "failed", error: err.message };
      results.push(result);
      onProgress?.(result);
    }

    if (delayMsBetween) {
      const [min, max] = delayMsBetween;
      await new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
    }
  }

  return results;
}

// Kept for the manual Multi Buyer page, where a flat amount is a
// deliberate user choice rather than a curve-derived plan.
export async function multiBuy(/* ...unchanged from before... */) {
  // existing implementation stays as-is
}
