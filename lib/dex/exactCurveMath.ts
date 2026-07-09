// lib/dex/exactCurveMath.ts
import { CurveConstants } from "./calibrateCurve";

const Q96 = 2 ** 96;

export interface CurveStep {
  ethInWei: bigint;
  tokensOutRaw: bigint;
  newSqrtPriceX96: bigint;
}

// Exact within-range V3 math: given ETH going in and current price,
// returns tokens out and the resulting new price — no approximation,
// as long as newSqrtPriceX96 stays below sqrtPriceUpperX96.
export function simulateBuyExact(
  ethInWei: bigint,
  currentSqrtPriceX96: bigint,
  curve: CurveConstants
): CurveStep {
  const L = Number(curve.liquidity);
  const sqrtPCurrent = Number(currentSqrtPriceX96) / Q96;
  const deltaY = Number(ethInWei) / 1e18;

  const sqrtPNew = sqrtPCurrent + deltaY / L;

  const sqrtPUpper = Number(curve.sqrtPriceUpperX96) / Q96;
  if (sqrtPNew > sqrtPUpper) {
    throw new Error(
      "Buy would cross the position's upper tick bound — curve assumption breaks here, need real tick-crossing math beyond this point."
    );
  }

  const tokensOut = L * (1 / sqrtPCurrent - 1 / sqrtPNew);

  return {
    ethInWei,
    tokensOutRaw: BigInt(Math.floor(tokensOut)),
    newSqrtPriceX96: BigInt(Math.floor(sqrtPNew * Q96)),
  };
}

// Inverse: given a desired token output, solve algebraically for
// exact ETH input needed. This is your "how much ETH for max wallet" answer.
export function ethNeededForExactTokens(
  desiredTokensRaw: bigint,
  currentSqrtPriceX96: bigint,
  curve: CurveConstants
): bigint {
  const L = Number(curve.liquidity);
  const sqrtPCurrent = Number(currentSqrtPriceX96) / Q96;
  const desiredTokens = Number(desiredTokensRaw);

  // From Δx = L*(1/sqrtP_current - 1/sqrtP_new), solve for sqrtP_new:
  const inverseSqrtPNew = 1 / sqrtPCurrent - desiredTokens / L;
  if (inverseSqrtPNew <= 0) {
    throw new Error("Desired token amount exceeds what's available before hitting price infinity — pool too shallow.");
  }
  const sqrtPNew = 1 / inverseSqrtPNew;
  const deltaY = L * (sqrtPNew - sqrtPCurrent);

  return BigInt(Math.floor(deltaY * 1e18));
}

// Sequential walk across N wallets — now pure math, instant, no RPC
// calls needed per step since we're just chaining the closed-form formula.
export function simulateSequentialExact(
  walletCount: number,
  targetTokensPerWallet: bigint,
  startingSqrtPriceX96: bigint,
  curve: CurveConstants
) {
  let currentPrice = startingSqrtPriceX96;
  const steps: { walletIndex: number; ethNeededWei: bigint; cumulativeEthWei: bigint }[] = [];
  let cumulative = 0n;

  for (let i = 0; i < walletCount; i++) {
    const ethNeeded = ethNeededForExactTokens(targetTokensPerWallet, currentPrice, curve);
    cumulative += ethNeeded;

    const step = simulateBuyExact(ethNeeded, currentPrice, curve);
    currentPrice = step.newSqrtPriceX96;

    steps.push({ walletIndex: i, ethNeededWei: ethNeeded, cumulativeEthWei: cumulative });
  }

  return steps;
}
