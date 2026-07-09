// lib/batch/topUp.ts
import { JsonRpcProvider, BrowserProvider, Wallet, parseEther, formatEther } from "ethers";

export interface TopUpResult {
  address: string;
  neededWei: bigint;
  status: "sent" | "skipped" | "failed";
  txHash?: string;
  error?: string;
}

// Checks each wallet's real balance against what it needs for its planned
// buy (plus gas headroom), and tops up the shortfall from the connected
// MetaMask wallet before any buy is attempted.
export async function topUpShortfalls(
  provider: JsonRpcProvider,
  signerProvider: BrowserProvider,
  wallets: { address: string; ethAmountNeeded: number }[],
  gasBufferEth = 0.0005
): Promise<TopUpResult[]> {
  const signer = await signerProvider.getSigner();
  const results: TopUpResult[] = [];

  for (const w of wallets) {
    const requiredWei = parseEther((w.ethAmountNeeded + gasBufferEth).toFixed(6));
    const currentBalance = await provider.getBalance(w.address);

    if (currentBalance >= requiredWei) {
      results.push({ address: w.address, neededWei: 0n, status: "skipped" });
      continue;
    }

    const shortfall = requiredWei - currentBalance;
    try {
      const tx = await signer.sendTransaction({ to: w.address, value: shortfall });
      const receipt = await tx.wait();
      results.push({ address: w.address, neededWei: shortfall, status: "sent", txHash: receipt?.hash });
    } catch (err: any) {
      results.push({ address: w.address, neededWei: shortfall, status: "failed", error: err.message });
    }
  }

  return results;
}
