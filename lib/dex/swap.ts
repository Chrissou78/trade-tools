// lib/dex/swap.ts
import { Contract, Wallet, parseEther } from "ethers";
import { ADDRESSES } from "../chains/robinhood";
import { getQuote } from "./quoter";

const WETH_ABI = [
  "function deposit() payable",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
];

interface ProtectedBuyParams {
  wallet: Wallet;
  tokenAddress: string;
  ethAmount: string;
  feeTier?: number;
  slippageBps?: number;     // e.g. 300 = 3% max acceptable deviation from quote
  deadlineSeconds?: number; // e.g. 60 = transaction must land within 60s or revert
}

export async function buyNoxaTokenProtected({
  wallet,
  tokenAddress,
  ethAmount,
  feeTier = 10000,
  slippageBps = 300,
  deadlineSeconds = 60,
}: ProtectedBuyParams) {
  const amountIn = parseEther(ethAmount);
  const provider = wallet.provider!;

  // 1. Fresh quote taken right before execution, not cached from earlier.
  const quotedOut = await getQuote(provider as any, tokenAddress, amountIn, feeTier);
  if (quotedOut === 0n) {
    throw new Error("Quote returned zero — pool may lack liquidity or address is wrong");
  }

  // 2. Compute the hard floor. If actual execution would return less than
  //    this, the swap call itself reverts on-chain — no partial loss possible.
  const amountOutMinimum = quotedOut - (quotedOut * BigInt(slippageBps)) / 10_000n;

  const weth = new Contract(ADDRESSES.weth, WETH_ABI, wallet);
  const router = new Contract(ADDRESSES.swapRouter02, SWAP_ROUTER_ABI, wallet);

  const wrapTx = await weth.deposit({ value: amountIn });
  await wrapTx.wait();

  const approveTx = await weth.approve(ADDRESSES.swapRouter02, amountIn);
  await approveTx.wait();

  // 3. Optional pre-flight simulation: staticCall the exact swap params
  //    before sending for real. If this throws, we abort before spending
  //    any gas on the real (reverting) transaction.
  try {
    await router.exactInputSingle.staticCall({
      tokenIn: ADDRESSES.weth,
      tokenOut: tokenAddress,
      fee: feeTier,
      recipient: wallet.address,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    });
  } catch (err: any) {
    throw new Error(`Simulation failed — trade would revert or exceed slippage: ${err.reason ?? err.message}`);
  }

  // 4. Real transaction. If chain state moves against us beyond our
  //    tolerance between quote and inclusion, this reverts on-chain.
  const swapTx = await router.exactInputSingle({
    tokenIn: ADDRESSES.weth,
    tokenOut: tokenAddress,
    fee: feeTier,
    recipient: wallet.address,
    amountIn,
    amountOutMinimum,
    sqrtPriceLimitX96: 0n,
  });

  return swapTx.wait();
}
