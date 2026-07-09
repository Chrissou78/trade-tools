// lib/dex/noxaBuy.ts
import { Contract, JsonRpcProvider, Wallet, parseEther } from "ethers";
import { ADDRESSES } from "../chains/robinhood";

const WETH_ABI = [
  "function deposit() payable",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
];

interface BuyParams {
  wallet: Wallet;
  tokenAddress: string;
  ethAmount: string;   // e.g. "0.05"
  feeTier?: number;    // NOXA single-sided LP defaults to 10000 (1%)
  slippageBps?: number; // e.g. 300 = 3%
}

export async function buyNoxaToken({
  wallet,
  tokenAddress,
  ethAmount,
  feeTier = 10000,
  slippageBps = 300,
}: BuyParams) {
  const amountIn = parseEther(ethAmount);

  const weth = new Contract(ADDRESSES.weth, WETH_ABI, wallet);
  const router = new Contract(ADDRESSES.swapRouter02, SWAP_ROUTER_ABI, wallet);

  // 1. Wrap ETH -> WETH
  const wrapTx = await weth.deposit({ value: amountIn });
  await wrapTx.wait();

  // 2. Approve router to spend WETH
  const approveTx = await weth.approve(ADDRESSES.swapRouter02, amountIn);
  await approveTx.wait();

  // 3. Swap WETH -> token
  // NOTE: amountOutMinimum should come from a QuoterV2 call in production,
  // not a naive 0 — this is just illustrating the swap shape.
  const swapTx = await router.exactInputSingle({
    tokenIn: ADDRESSES.weth,
    tokenOut: tokenAddress,
    fee: feeTier,
    recipient: wallet.address,
    amountIn,
    amountOutMinimum: 0n,
    sqrtPriceLimitX96: 0n,
  });

  return swapTx.wait();
}

export async function buyAcrossWallets(
  provider: JsonRpcProvider,
  privateKeys: string[],
  tokenAddress: string,
  ethAmountEach: string
) {
  const wallets = privateKeys.map((pk) => new Wallet(pk, provider));
  // Fire concurrently — each wallet has its own nonce, so this is safe.
  return Promise.allSettled(
    wallets.map((wallet) =>
      buyNoxaToken({ wallet, tokenAddress, ethAmount: ethAmountEach })
    )
  );
}
