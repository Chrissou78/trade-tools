// lib/dex/empiricalSim.ts
import { NOXA_ROBINHOOD_CONSTANTS, simulateBuyExact, planSequentialBuys, CurveCalibration, WalletBuyStep } from "./noxaCurve";

const Q96 = 2 ** 96;

export interface EmpiricalSimInput {
  ownerBuyEth: number;
  walletCount: number;
  targetPctOfSupplyPerWallet: number; // 0.02 = 2%
  liquidityL: number;                 // editable — see note below
  ethPriceUsd: number;
}

export function simulateFromOwnerBuy(input: EmpiricalSimInput): { afterOwnerBuyMcUsd: number; steps: WalletBuyStep[] } {
  const floorSqrtP = Number(NOXA_ROBINHOOD_CONSTANTS.floorSqrtPriceX96) / Q96;
  const curve: CurveCalibration = { liquidity: input.liquidityL, feeRate: NOXA_ROBINHOOD_CONSTANTS.feeRate };

  const { newSqrtP } = simulateBuyExact(input.ownerBuyEth, floorSqrtP, curve);

  const targetTokensPerWallet = NOXA_ROBINHOOD_CONSTANTS.totalSupply * input.targetPctOfSupplyPerWallet;
  const steps = planSequentialBuys(
    input.walletCount,
    targetTokensPerWallet,
    newSqrtP,
    curve,
    NOXA_ROBINHOOD_CONSTANTS.totalSupply,
    input.ethPriceUsd
  );

  return { afterOwnerBuyMcUsd: steps.length ? steps[0].mcAfterUsd : 0, steps };
}

// Placeholder liquidity depth until calibrated against a real live launch.
// The UI lets you override this — treat results as directional, not exact,
// until you've confirmed L against at least one real transaction.
export const DEFAULT_LIQUIDITY_ESTIMATE = 2_500_000;
