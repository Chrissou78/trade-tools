// lib/batch/sender.ts
import { Contract, JsonRpcSigner, Wallet, formatEther, parseEther } from "ethers";

export interface SendResult {
  address: string;
  status: "success" | "failed";
  txHash?: string;
  error?: string;
}

// Distribute ETH from one funded signer to many recipient addresses.
// Works whether the signer is the MetaMask main wallet or a local Wallet object.
export async function distributeEth(
  signer: JsonRpcSigner | Wallet,
  recipients: string[],
  amountEachEth: string,
  onProgress?: (result: SendResult) => void
): Promise<SendResult[]> {
  const amount = parseEther(amountEachEth);
  const results: SendResult[] = [];

  for (const to of recipients) {
    try {
      const tx = await signer.sendTransaction({ to, value: amount });
      const receipt = await tx.wait();
      const result: SendResult = { address: to, status: "success", txHash: receipt?.hash };
      results.push(result);
      onProgress?.(result);
    } catch (err: any) {
      const result: SendResult = { address: to, status: "failed", error: err.message };
      results.push(result);
      onProgress?.(result);
    }
  }
  return results;
}

// Sweep ETH balance (minus gas buffer) from many local wallets back to one address.
export async function collectEth(
  wallets: Wallet[],
  destination: string,
  onProgress?: (result: SendResult) => void
): Promise<SendResult[]> {
  const results: SendResult[] = [];

  for (const wallet of wallets) {
    try {
      const provider = wallet.provider!;
      const balance = await provider.getBalance(wallet.address);
      const feeData = await provider.getFeeData();
      const gasLimit = 21_000n;
      const gasCost = (feeData.gasPrice ?? 0n) * gasLimit;
      const sendAmount = balance - gasCost;

      if (sendAmount <= 0n) {
        const result: SendResult = { address: wallet.address, status: "failed", error: "Insufficient balance to cover gas" };
        results.push(result);
        onProgress?.(result);
        continue;
      }

      const tx = await wallet.sendTransaction({ to: destination, value: sendAmount, gasLimit });
      const receipt = await tx.wait();
      const result: SendResult = { address: wallet.address, status: "success", txHash: receipt?.hash };
      results.push(result);
      onProgress?.(result);
    } catch (err: any) {
      const result: SendResult = { address: wallet.address, status: "failed", error: err.message };
      results.push(result);
      onProgress?.(result);
    }
  }
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
  const results: SendResult[] = [];

  for (const to of recipients) {
    try {
      const tx = await token.transfer(to, amountEachWei);
      const receipt = await tx.wait();
      const result: SendResult = { address: to, status: "success", txHash: receipt.hash };
      results.push(result);
      onProgress?.(result);
    } catch (err: any) {
      const result: SendResult = { address: to, status: "failed", error: err.message };
      results.push(result);
      onProgress?.(result);
    }
  }
  return results;
}

export interface VariableSendItem {
  address: string;
  amountWei: bigint;
}

export async function distributeVariableEth(
  signer: JsonRpcSigner | Wallet,
  items: VariableSendItem[],
  onProgress?: (result: SendResult) => void
): Promise<SendResult[]> {
  const results: SendResult[] = [];

  for (const { address, amountWei } of items) {
    try {
      const tx = await signer.sendTransaction({ to: address, value: amountWei });
      const receipt = await tx.wait();
      const result: SendResult = { address, status: "success", txHash: receipt?.hash };
      results.push(result);
      onProgress?.(result);
    } catch (err: any) {
      const result: SendResult = { address, status: "failed", error: err.message };
      results.push(result);
      onProgress?.(result);
    }
  }
  return results;
}
