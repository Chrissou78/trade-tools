// lib/batch/prepareBuy.ts
//
// Two-phase launch buying, built to survive a weak RPC.
//
//   Phase 1 (ahead of launch): prepareWallets() wraps each wallet's ETH into
//   WETH and approves the router. It is idempotent — re-running only does the
//   missing pieces — so a dropped request can be retried safely.
//
//   Phase 2 (at launch): fireSwaps() sends one swap per wallet. Each swap uses
//   a fixed nonce, so a retry after a dropped connection can never double-buy:
//   if the first attempt actually reached the chain, the retry is rejected as a
//   duplicate and we count it as sent.
//
// Both run through a concurrency pool with automatic retry on transient network
// errors ("Failed to fetch", rate limits, timeouts). Endpoints that only accept
// a couple of simultaneous requests still get every wallet through, just spread
// across a few blocks instead of one instant.
import { Contract, Wallet, formatEther, MaxUint256 } from "ethers";
import { ADDRESSES } from "../chains/robinhood";
import { getQuote } from "../dex/quoter";

const WETH_ABI = [
  "function deposit() payable",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
];

export interface PrepareResult {
  address: string;
  status: "success" | "failed";
  wrappedEth?: string;
  error?: string;
}

export interface SwapResult {
  address: string;
  status: "success" | "failed";
  txHash?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A dropped/rate-limited request that is safe to retry.
function isTransient(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("could not detect network") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("429") ||
    m.includes("502") ||
    m.includes("503") ||
    m.includes("econnreset") ||
    m.includes("network error") ||
    m.includes("server error") ||
    m.includes("load failed")
  );
}

// The tx was already accepted on a previous attempt (same nonce). Treat as sent.
function isAlreadySent(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("nonce too low") ||
    m.includes("already known") ||
    m.includes("already imported") ||
    m.includes("replacement transaction underpriced") ||
    m.includes("known transaction")
  );
}

// Run `worker` over every item, but never more than `concurrency` at a time.
// Results come back in input order. The worker handles its own errors.
export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const lanes = Math.max(1, Math.min(concurrency, items.length));

  async function lane() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: lanes }, () => lane()));
  return results;
}

// Phase 1: ensure each wallet holds at least `amountWei` of WETH and a router
// allowance. Idempotent and retried, so a flaky RPC won't leave it half-done.
export async function prepareWallets(
  items: { wallet: Wallet; amountWei: bigint }[],
  concurrency = 2,
  retries = 4,
  onProgress?: (r: PrepareResult) => void
): Promise<PrepareResult[]> {
  return runPool(items, concurrency, async ({ wallet, amountWei }) => {
    const weth = new Contract(ADDRESSES.weth, WETH_ABI, wallet);
    let lastErr: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (amountWei <= 0n) throw new Error("Nothing to wrap after gas reserve");

        const [balance, allowance] = await Promise.all([
          weth.balanceOf(wallet.address) as Promise<bigint>,
          weth.allowance(wallet.address, ADDRESSES.swapRouter02) as Promise<bigint>,
        ]);

        const needWrap = balance < amountWei ? amountWei - balance : 0n;
        const needApprove = allowance < amountWei;

        let nonce = await wallet.getNonce("pending");
        const pending: Promise<unknown>[] = [];
        if (needWrap > 0n) {
          const tx = await weth.deposit({ value: needWrap, nonce: nonce++ });
          pending.push(tx.wait());
        }
        if (needApprove) {
          const tx = await weth.approve(ADDRESSES.swapRouter02, MaxUint256, { nonce: nonce++ });
          pending.push(tx.wait());
        }
        await Promise.all(pending);

        const result: PrepareResult = { address: wallet.address, status: "success", wrappedEth: formatEther(amountWei) };
        onProgress?.(result);
        return result;
      } catch (err: any) {
        lastErr = err;
        const msg = err?.message ?? String(err);
        if (attempt < retries && isTransient(msg)) {
          await sleep(500 * (attempt + 1) + Math.random() * 400);
          continue;
        }
        break;
      }
    }

    const result: PrepareResult = { address: wallet.address, status: "failed", error: (lastErr as any)?.message ?? String(lastErr) };
    onProgress?.(result);
    return result;
  });
}

// Phase 2: one swap per wallet, from its WETH balance. Fixed nonce + retry makes
// a dropped send safe to resend without risking a double-buy.
export async function fireSwaps(
  wallets: Wallet[],
  tokenAddress: string,
  slippageBps = 5000,
  feeTier = 10000,
  concurrency = wallets.length,
  retries = 4,
  onProgress?: (r: SwapResult) => void
): Promise<SwapResult[]> {
  return runPool(wallets, concurrency, async (wallet) => {
    try {
      const weth = new Contract(ADDRESSES.weth, WETH_ABI, wallet);
      const router = new Contract(ADDRESSES.swapRouter02, SWAP_ROUTER_ABI, wallet);

      const amountIn: bigint = await weth.balanceOf(wallet.address);
      if (amountIn === 0n) throw new Error("No WETH — prepare (wrap) this wallet first");

      const quotedOut = await getQuote(wallet.provider as any, tokenAddress, amountIn, feeTier);
      if (quotedOut === 0n) throw new Error("Quote returned zero — pool may lack liquidity or address is wrong");
      const amountOutMinimum = quotedOut - (quotedOut * BigInt(slippageBps)) / 10_000n;

      const params = {
        tokenIn: ADDRESSES.weth,
        tokenOut: tokenAddress,
        fee: feeTier,
        recipient: wallet.address,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      };

      try {
        await router.exactInputSingle.staticCall(params);
      } catch (err: any) {
        throw new Error(`Simulation failed — trade would revert or exceed slippage: ${err.reason ?? err.message}`);
      }

      // Fixed nonce so a retry after a dropped send cannot double-buy.
      const nonce = await wallet.getNonce("pending");
      let lastErr: unknown;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const swapTx = await router.exactInputSingle({ ...params, nonce });
          const receipt = await swapTx.wait();
          const result: SwapResult = { address: wallet.address, status: "success", txHash: receipt?.hash };
          onProgress?.(result);
          return result;
        } catch (err: any) {
          lastErr = err;
          const msg = err?.message ?? String(err);
          if (isAlreadySent(msg)) {
            const result: SwapResult = { address: wallet.address, status: "success" };
            onProgress?.(result);
            return result;
          }
          if (attempt < retries && isTransient(msg)) {
            await sleep(500 * (attempt + 1) + Math.random() * 400);
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    } catch (err: any) {
      const result: SwapResult = { address: wallet.address, status: "failed", error: err?.message ?? String(err) };
      onProgress?.(result);
      return result;
    }
  });
}
