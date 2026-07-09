// lib/batch/seller.ts
import { Wallet } from "ethers";
import { sellNoxaToken } from "../dex/sell";

export interface SellResult {
  address: string;
  status: "success" | "partial" | "failed";
  txHash?: string;
  unwrapTxHash?: string;
  error?: string;
}

export interface MultiSellConfig {
  wallets: Wallet[];
  tokenAddress: string;
  sellPercentage: number;
  slippageBps?: number;
}

export async function multiSell(
  config: MultiSellConfig,
  onProgress?: (result: SellResult) => void
): Promise<SellResult[]> {
  const results: SellResult[] = [];

  for (const wallet of config.wallets) {
    try {
      const outcome = await sellNoxaToken({
        wallet,
        tokenAddress: config.tokenAddress,
        sellPercentage: config.sellPercentage,
        slippageBps: config.slippageBps ?? 500,
      });

      // outcome.status is either "success" or "partial" here — sellNoxaToken
      // only throws if the actual token sale itself failed, so reaching
      // this branch always means the sale went through.
      const result: SellResult = {
        address: wallet.address,
        status: outcome.status,
        txHash: outcome.swapTxHash,
        unwrapTxHash: outcome.unwrapTxHash,
        error: outcome.unwrapError,
      };
      results.push(result);
      onProgress?.(result);
    } catch (err: any) {
      // Only reachable if the sale itself failed — balance check, approve,
      // quote, or the swap transaction reverting.
      const result: SellResult = { address: wallet.address, status: "failed", error: err.message };
      results.push(result);
      onProgress?.(result);
    }
  }

  return results;
}
