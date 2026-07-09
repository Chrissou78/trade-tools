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
//
// Balance checks run in parallel (read-only, no dependency between them).
// Any required top-up sends share the MetaMask signer, so they're fired
// with manually sequenced nonces rather than waiting on confirmation
// between each one, then all receipts are awaited together at the end.
export async function topUpShortfalls(
  provider: JsonRpcProvider,
  signerProvider: BrowserProvider,
  wallets: { address: string; ethAmountNeeded: number }[],
  gasBufferEth = 0.0005
): Promise<TopUpResult[]> {
  const signer = await signerProvider.getSigner();

  // Phase 1: compute shortfalls for every wallet in parallel.
  const shortfallChecks = await Promise.all(
    wallets.map(async (w) => {
      const requiredWei = parseEther((w.ethAmountNeeded + gasBufferEth).toFixed(6));
      const currentBalance = await provider.getBalance(w.address);
      const shortfall = currentBalance >= requiredWei ? 0n : requiredWei - currentBalance;
      return { address: w.address, shortfall };
    })
  );

  const results: TopUpResult[] = new Array(wallets.length);
  const toSend: { i: number; address: string; shortfall: bigint }[] = [];

  shortfallChecks.forEach((check, i) => {
    if (check.shortfall === 0n) {
      results[i] = { address: check.address, neededWei: 0n, status: "skipped" };
    } else {
      toSend.push({ i, address: check.address, shortfall: check.shortfall });
    }
  });

  if (toSend.length === 0) return results;

  // Phase 2: fire all required top-up sends with sequential nonces.
  const startNonce = await signer.getNonce("pending");

  const sendOutcomes = await Promise.allSettled(
    toSend.map(({ address, shortfall }, idx) =>
      signer.sendTransaction({ to: address, value: shortfall, nonce: startNonce + idx })
    )
  );

  const pendingWaits: { i: number; address: string; shortfall: bigint; tx: any }[] = [];

  sendOutcomes.forEach((outcome, idx) => {
    const { i, address, shortfall } = toSend[idx];
    if (outcome.status === "fulfilled") {
      pendingWaits.push({ i, address, shortfall, tx: outcome.value });
    } else {
      results[i] = { address, neededWei: shortfall, status: "failed", error: outcome.reason?.message ?? String(outcome.reason) };
    }
  });

  // Phase 3: await all receipts together.
  const waitOutcomes = await Promise.allSettled(pendingWaits.map(({ tx }) => tx.wait()));

  waitOutcomes.forEach((outcome, idx) => {
    const { i, address, shortfall } = pendingWaits[idx];
    results[i] =
      outcome.status === "fulfilled"
        ? { address, neededWei: shortfall, status: "sent", txHash: outcome.value?.hash }
        : { address, neededWei: shortfall, status: "failed", error: outcome.reason?.message ?? String(outcome.reason) };
  });

  return results;
}
