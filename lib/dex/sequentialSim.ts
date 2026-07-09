// lib/dex/sequentialSim.ts
import JSBI from "jsbi";
import { Pool, TickMath, TickListDataProvider } from "@uniswap/v3-sdk";
import { Token, CurrencyAmount } from "@uniswap/sdk-core";
import { JsonRpcProvider } from "ethers";
import { findPoolAndState } from "./pool";
import { discoverTokenLimits } from "./tokenLimits";
import { ADDRESSES } from "../chains/robinhood";

const ROBINHOOD_CHAIN_ID = 4663;

export interface WalletLoadStep {
  walletIndex: number;
  targetTokensHuman: string;
  ethNeededWei: bigint;
  ethNeededHuman: string;
  cumulativeEthWei: bigint;
  cumulativeEthHuman: string;
}

export interface SequentialLoadPlan {
  tokenAddress: string;
  poolAddress: string;
  feeTier: number;
  maxWalletTokensRaw: bigint;
  targetTokensPerWalletRaw: bigint;
  steps: WalletLoadStep[];
  totalEthNeededHuman: string;
  caveat: string;
}

/**
 * Walks the pool curve sequentially across `walletCount` hypothetical
 * buys, each targeting `targetPctOfCap` of the max-wallet limit.
 * Each step's cost reflects the price impact of ALL prior steps —
 * this is what makes wallet #10 cost more ETH than wallet #1 for the
 * same token amount.
 *
 * APPROXIMATION NOTE: this uses only the pool's currently active
 * liquidity (from `liquidity()`), treating it as constant across the
 * price range being traversed. If NOXA's single-sided LP concentrates
 * liquidity in a narrow tick range, a large simulated buy can cross out
 * of that range — real execution cost would then jump higher than this
 * model predicts. For a fully rigorous simulation we'd fetch actual
 * initialized ticks around the current price and feed them into
 * TickListDataProvider instead of the single-tick fallback below.
 * Worth doing once we have the real token and can inspect its actual
 * liquidity distribution on the explorer.
 */
export async function simulateSequentialLoadPlan(
  provider: JsonRpcProvider,
  tokenAddress: string,
  walletCount: number,
  targetPctOfCap = 0.96
): Promise<SequentialLoadPlan> {
  const state = await findPoolAndState(provider, tokenAddress);
  const limits = await discoverTokenLimits(provider, tokenAddress);

  if (!limits.maxWalletTokens) {
    throw new Error("Could not read max-wallet limit — verify the token's ABI on Blockscout first.");
  }

  const isToken0Weth = state.token0.toLowerCase() === ADDRESSES.weth.toLowerCase();
  const weth = new Token(ROBINHOOD_CHAIN_ID, ADDRESSES.weth, 18, "WETH");
  const token = new Token(ROBINHOOD_CHAIN_ID, tokenAddress, limits.decimals, "TOKEN");

  const token0 = isToken0Weth ? weth : token;
  const token1 = isToken0Weth ? token : weth;

  // Fallback tick data: a single fabricated tick range spanning the full
  // usable price space, carrying the pool's current active liquidity.
  // This is the "constant liquidity" approximation flagged above.
  const tickDataProvider = new TickListDataProvider(
    [
      { index: TickMath.MIN_TICK, liquidityNet: JSBI.BigInt(state.liquidity.toString()), liquidityGross: JSBI.BigInt(state.liquidity.toString()) },
      { index: TickMath.MAX_TICK, liquidityNet: JSBI.BigInt(state.liquidity.toString()) * JSBI.BigInt(-1), liquidityGross: JSBI.BigInt(state.liquidity.toString()) },
    ],
    state.tickSpacing
  );

  let pool = new Pool(
    token0,
    token1,
    3000, // fee param here is informational display only in SDK's Pool; actual fee tier already fixed by pool address
    JSBI.BigInt(state.sqrtPriceX96.toString()),
    JSBI.BigInt(state.liquidity.toString()),
    state.tick,
    tickDataProvider
  );

  const targetPerWallet = BigInt(Math.floor(Number(limits.maxWalletTokens) * targetPctOfCap));
  const targetAmountCurrency = CurrencyAmount.fromRawAmount(token, JSBI.BigInt(targetPerWallet.toString()));

  const steps: WalletLoadStep[] = [];
  let cumulativeEth = 0n;

  for (let i = 0; i < walletCount; i++) {
    const [ethInputAmount, newPool] = await pool.getInputAmount(targetAmountCurrency);

    const ethNeededWei = BigInt(ethInputAmount.quotient.toString());
    cumulativeEth += ethNeededWei;

    steps.push({
      walletIndex: i,
      targetTokensHuman: (Number(targetPerWallet) / 10 ** limits.decimals).toString(),
      ethNeededWei,
      ethNeededHuman: (Number(ethNeededWei) / 1e18).toFixed(6),
      cumulativeEthWei: cumulativeEth,
      cumulativeEthHuman: (Number(cumulativeEth) / 1e18).toFixed(6),
    });

    pool = newPool; // carry forward post-trade state to the next wallet
  }

  return {
    tokenAddress,
    poolAddress: state.poolAddress,
    feeTier: 10000,
    maxWalletTokensRaw: limits.maxWalletTokens,
    targetTokensPerWalletRaw: targetPerWallet,
    steps,
    totalEthNeededHuman: (Number(cumulativeEth) / 1e18).toFixed(6),
    caveat:
      "Approximated with constant active liquidity across the full price range — does not account for tick-boundary crossing within NOXA's single-sided LP position.",
  };
}
