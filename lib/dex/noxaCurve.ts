// lib/dex/noxaCurve.ts
// Calibrated model of NOXA Fun's standardized single-sided launch curve
// on Robinhood Chain, derived from real on-chain launches.

import { Contract, JsonRpcProvider } from "ethers";

const Q96 = 2 ** 96;

// ---- Universal constants, confirmed identical across 2+ independent launches ----
export const NOXA_ROBINHOOD_CONSTANTS = {
  floorTick: 204200,
  floorSqrtPriceX96: 2151813121295408910812139624586144n,
  feeTier: 10000,        // 1%
  feeRate: 0.01,
  tickSpacing: 200,
  totalSupply: 1_000_000_000, // whole tokens, 18 decimals
};

function sqrtPFromX96(sqrtPriceX96: bigint): number {
  return Number(sqrtPriceX96) / Q96;
}

// ---- Step 1: get the real, current liquidity L for a specific pool ----
// Preferred method: read the exact value straight from the Mint event.
// This is unambiguous — no fee assumptions involved.
export async function getExactLiquidityFromMint(
  provider: JsonRpcProvider,
  poolAddress: string
): Promise<bigint> {
  const pool = new Contract(
    poolAddress,
    ["event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)"],
    provider
  );
  const events = await pool.queryFilter(pool.filters.Mint(), 0, "latest");
  if (events.length === 0) throw new Error("No Mint event found for this pool.");
  return BigInt((events[0] as any).args.amount.toString());
}

// Fallback method: back-solve L from a known swap's ETH-in / token-out.
// Accurate to within ~1% (the pool fee is not cleanly separated out here).
// Use only if the Mint event can't be read directly.
export function backSolveLiquidityFromSwap(
  ethEffectiveIn: number,   // ETH that actually entered the curve (post-fee)
  tokensOut: number,
  startingSqrtP: number
): number {
  const a = startingSqrtP;
  const M = tokensOut;
  const ethEff = ethEffectiveIn;
  return (ethEff * M) / (ethEff * a - M / a);
}

// ---- Step 2: read live current price (reflects any buys already landed) ----
export async function getLiveSqrtPrice(
  provider: JsonRpcProvider,
  poolAddress: string
): Promise<number> {
  const pool = new Contract(
    poolAddress,
    ["function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)"],
    provider
  );
  const slot0 = await pool.slot0();
  return sqrtPFromX96(BigInt(slot0.sqrtPriceX96.toString()));
}

// ---- Step 3: exact curve math, fee-aware ----

export interface CurveCalibration {
  liquidity: number;     // L, in whole-token-equivalent units
  feeRate: number;       // e.g. 0.01
}

// Given a target token output, returns the exact gross ETH (including fee)
// the buyer must send, plus the resulting price after the trade.
export function ethNeededForExactTokens(
  targetTokensOut: number,
  currentSqrtP: number,
  curve: CurveCalibration
): { ethGrossIn: number; ethEffective: number; newSqrtP: number } {
  const { liquidity: L, feeRate } = curve;
  const a = currentSqrtP;
  const M = targetTokensOut;

  if (L * a <= M) {
    throw new Error("Target token amount exceeds what this liquidity position can supply before running dry.");
  }

  const ethEffective = (L * M) / (a * (L * a - M));
  const ethGrossIn = ethEffective / (1 - feeRate);
  const newSqrtP = 1 / (1 / a + ethEffective / L);

  return { ethGrossIn, ethEffective, newSqrtP };
}

// Inverse check: given gross ETH in, how many tokens come out and what's the new price.
export function simulateBuyExact(
  ethGrossIn: number,
  currentSqrtP: number,
  curve: CurveCalibration
): { tokensOut: number; newSqrtP: number } {
  const { liquidity: L, feeRate } = curve;
  const a = currentSqrtP;
  const ethEffective = ethGrossIn * (1 - feeRate);

  const newSqrtP = 1 / (1 / a + ethEffective / L);
  const tokensOut = L * (a - newSqrtP);

  return { tokensOut, newSqrtP };
}

export function sqrtPToMarketCapUsd(sqrtP: number, totalSupply: number, ethPriceUsd: number): number {
  const priceRaw = sqrtP * sqrtP;          // tokens per WETH
  const tokenPriceInWeth = 1 / priceRaw;
  return tokenPriceInWeth * totalSupply * ethPriceUsd;
}

// ---- Step 4: the sequential multi-wallet planner you actually need ----

export interface WalletBuyStep {
  walletIndex: number;
  targetTokens: number;
  ethGrossToSend: number;
  cumulativeEth: number;
  mcAfterUsd: number;
}

export function planSequentialBuys(
  walletCount: number,
  targetTokensPerWallet: number,
  startingSqrtP: number,
  curve: CurveCalibration,
  totalSupply: number,
  ethPriceUsd: number
): WalletBuyStep[] {
  let sqrtP = startingSqrtP;
  let cumulative = 0;
  const steps: WalletBuyStep[] = [];

  for (let i = 0; i < walletCount; i++) {
    const { ethGrossIn, newSqrtP } = ethNeededForExactTokens(targetTokensPerWallet, sqrtP, curve);
    cumulative += ethGrossIn;
    sqrtP = newSqrtP;

    steps.push({
      walletIndex: i,
      targetTokens: targetTokensPerWallet,
      ethGrossToSend: ethGrossIn,
      cumulativeEth: cumulative,
      mcAfterUsd: sqrtPToMarketCapUsd(sqrtP, totalSupply, ethPriceUsd),
    });
  }

  return steps;
}
