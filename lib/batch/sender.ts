// lib/batch/sender.ts
import { Contract, JsonRpcSigner, Wallet, formatEther, parseEther } from "ethers";

export interface SendResult {
  address: string;
  status: "success" | "failed";
  txHash?: string;
  error?: string;
}

// Distribute ETH from one funded signer to many recipient addresses.
// Sends are fired with sequential nonces without waiting for each to confirm,
// then all receipts are awaited together at the end.
export async function distributeEth(
  signer: JsonRpcSigner | Wallet,
  recipients: string[],
  amountEachEth: string,
  onProgress?: (result: SendResult) => void
): Promise<SendResult[]> {
  const amount = parseEther(amountEachEth);
  const items = recipients.map((address) => ({ address, amountWei: amount }));
  return distributeVariableEth(signer, items, onProgress);
}

// Sweep ETH balance (minus gas buffer) from many local wallets back to one address.
// These originate from different keys, so they have no nonce dependency on each
// other and can be sent fully in parallel.
export async function collectEth(
  wallets: Wallet[],
  destination: string,
  onProgress?: (result: SendResult) => void
): Promise<SendResult[]> {
  const outcomes = await Promise.allSettled(
    wallets.map(async (wallet) => {
      const provider = wallet.provider!;
      const [balance, feeData] = await Promise.all([
        provider.getBalance(wallet.address),
        provider.getFeeData(),
      ]);
      const gasLimit = 21_000n;
      const gasCost = (feeData.gasPrice ?? 0n) * gasLimit;
      const sendAmount = balance - gasCost;

      if (sendAmount <= 0n) {
        throw new Error("Insufficient balance to cover gas");
      }

      const tx = await wallet.sendTransaction({ to: destination, value: sendAmount, gasLimit });
      const receipt = await tx.wait();
      return { address: wallet.address, status: "success" as const, txHash: receipt?.hash };
    })
  );

  const results: SendResult[] = outcomes.map((outcome, i) => {
    const address = wallets[i].address;
    const result: SendResult =
      outcome.status === "fulfilled"
        ? outcome.value
        : { address, status: "failed", error: outcome.reason?.message ?? String(outcome.reason) };
    onProgress?.(result);
    return result;
  });

  return results;
}

// ERC20 variant, for sending/sweeping tokens instead of native ETH.
const ERC20_ABI = ["function transfer(address to, uint256 amount) returns (bool)", "function balanceOf(address) view returns (uint256)"];

export async function distributeToken(
  signer: JsonRpcSigner | Wallet,
  tokenAddress: string,
  recipients: string[],
  amountEachWei: bigint,
  onProgress?: (result: SendResult) => void
): Promise<SendResult[]> {
  const token = new Contract(tokenAddress, ERC20_ABI, signer);
  const startNonce = await signer.getNonce("pending");

  const sendOutcomes = await Promise.allSettled(
    recipients.map((to, i) => token.transfer(to, amountEachWei, { nonce: startNonce + i }))
  );

  const results: SendResult[] = [];
  const pendingWaits: { i: number; tx: any }[] = [];

  sendOutcomes.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      pendingWaits.push({ i, tx: outcome.value });
    } else {
      const result: SendResult = { address: recipients[i], status: "failed", error: outcome.reason?.message ?? String(outcome.reason) };
      results[i] = result;
      onProgress?.(result);
    }
  });

  const waitOutcomes = await Promise.allSettled(pendingWaits.map(({ tx }) => tx.wait()));

  waitOutcomes.forEach((outcome, idx) => {
    const { i } = pendingWaits[idx];
    const result: SendResult =
      outcome.status === "fulfilled"
        ? { address: recipients[i], status: "success", txHash: outcome.value.hash }
        : { address: recipients[i], status: "failed", error: outcome.reason?.message ?? String(outcome.reason) };
    results[i] = result;
    onProgress?.(result);
  });

  return results;
}

export interface VariableSendItem {
  address: string;
  amountWei: bigint;
}

// Sends all funding transactions with manually sequenced nonces so they don't
// wait on each other's confirmations, then awaits all receipts together.
// Because these share one signer (e.g. MetaMask), each send still requires
// individual wallet approval — but approvals no longer block on mining time.
export async function distributeVariableEth(
  signer: JsonRpcSigner | Wallet,
  items: VariableSendItem[],
  onProgress?: (result: SendResult) => void
): Promise<SendResult[]> {
  const startNonce = await signer.getNonce("pending");

  const sendOutcomes = await Promise.allSettled(
    items.map(({ address, amountWei }, i) =>
      signer.sendTransaction({ to: address, value: amountWei, nonce: startNonce + i })
    )
  );

  const results: SendResult[] = new Array(items.length);
  const pendingWaits: { i: number; tx: any }[] = [];

  sendOutcomes.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      pendingWaits.push({ i, tx: outcome.value });
    } else {
      const result: SendResult = { address: items[i].address, status: "failed", error: outcome.reason?.message ?? String(outcome.reason) };
      results[i] = result;
      onProgress?.(result);
    }
  });

  const waitOutcomes = await Promise.allSettled(pendingWaits.map(({ tx }) => tx.wait()));

  waitOutcomes.forEach((outcome, idx) => {
    const { i } = pendingWaits[idx];
    const result: SendResult =
      outcome.status === "fulfilled"
        ? { address: items[i].address, status: "success", txHash: outcome.value?.hash }
        : { address: items[i].address, status: "failed", error: outcome.reason?.message ?? String(outcome.reason) };
    results[i] = result;
    onProgress?.(result);
  });

  return results;
}
