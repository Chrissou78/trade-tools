// lib/dex/sell.ts
import { Contract, Wallet } from "ethers";
import { ADDRESSES } from "../chains/robinhood";
import { getQuoteReverse } from "./quoter";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
];

const WETH_ABI = ["function withdraw(uint256 amount)"];

interface SellParams {
  wallet: Wallet;
  tokenAddress: string;
  sellPercentage: number;   // 100 = full balance
  feeTier?: number;
  slippageBps?: number;
  unwrapToEth?: boolean;    // if true, converts WETH proceeds to native ETH in a second tx
}

// Distinguishes "everything worked" from "sold fine, but the unwrap step
// failed" — the latter is not a lost-funds scenario (WETH is still fully
// the wallet's own asset), just a state that needs surfacing rather than
// being silently treated as a hard failure.
export interface SellOutcome {
  status: "success" | "partial";
  swapTxHash: string;
  unwrapTxHash?: string;
  unwrapError?: string;
}

export async function sellNoxaToken({
  wallet,
  tokenAddress,
  sellPercentage,
  feeTier = 10000,
  slippageBps = 500,
  unwrapToEth = true,
}: SellParams): Promise<SellOutcome> {
  const token = new Contract(tokenAddress, ERC20_ABI, wallet);
  const balance: bigint = await token.balanceOf(wallet.address);
  if (balance === 0n) throw new Error("No token balance to sell.");

  const amountIn = (balance * BigInt(Math.floor(sellPercentage * 100))) / 10_000n;

  const allowance: bigint = await token.allowance(wallet.address, ADDRESSES.swapRouter02);
  if (allowance < amountIn) {
    const approveTx = await token.approve(ADDRESSES.swapRouter02, amountIn);
    await approveTx.wait();
  }

  const quotedOut = await getQuoteReverse(wallet.provider as any, tokenAddress, amountIn, feeTier);
  const amountOutMinimum = quotedOut - (quotedOut * BigInt(slippageBps)) / 10_000n;

  const router = new Contract(ADDRESSES.swapRouter02, SWAP_ROUTER_ABI, wallet);

  const swapTx = await router.exactInputSingle({
    tokenIn: tokenAddress,
    tokenOut: ADDRESSES.weth,
    fee: feeTier,
    recipient: wallet.address,
    amountIn,
    amountOutMinimum,
    sqrtPriceLimitX96: 0n,
  });

  const receipt = await swapTx.wait();
  if (!receipt) {
    throw new Error("Swap transaction did not return a receipt.");
  }

  if (!unwrapToEth) {
    return { status: "success", swapTxHash: receipt.hash };
  }

  // Unwrap is isolated in its own try/catch deliberately — a failure here
  // must NOT throw and wipe out the fact that the sale itself succeeded.
  try {
    const weth = new Contract(ADDRESSES.weth, WETH_ABI, wallet);
    const unwrapTx = await weth.withdraw(quotedOut);
    const unwrapReceipt = await unwrapTx.wait();
    return { status: "success", swapTxHash: receipt.hash, unwrapTxHash: unwrapReceipt?.hash };
  } catch (err: any) {
    return { status: "partial", swapTxHash: receipt.hash, unwrapError: err.message };
  }
}
