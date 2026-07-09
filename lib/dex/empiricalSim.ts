// lib/dex/empiricalSim.ts
import {
  NOXA_ROBINHOOD_CONSTANTS,
  backSolveLiquidityFromSwap,
  ethNeededForExactTokens,
  simulateBuyExact,
  sqrtPToMarketCapUsd,
} from "./noxaCurve";

const Q96 = 2 ** 96;
const { floorSqrtPriceX96, feeRate, totalSupply } = NOXA_ROBINHOOD_CONSTANTS;

// Exact floor sqrtP ("a" convention: sqrt(TOKEN per WETH)), computed directly
// from the on-chain-verified constant. This is real division on real floats —
// no manual rounding involved.
const FLOOR_SQRT_P = Number(floorSqrtPriceX96) / Q96;

// ---- Calibration anchor: one real observed buy from an actual NOXA
// Robinhood launch (0.04 ETH gross in -> 28,751,714.68 tokens out). ----
// This single data point is passed through backSolveLiquidityFromSwap —
// the closed-form inverse of the exact same Uniswap V3 swap formula used
// everywhere else in this file — to solve for the curve's liquidity
// constant L. Everything downstream of this is pure algebra on L, the
// floor price, and the fee rate. No lookup table, no interpolation.
const CALIBRATION_ETH_GROSS = 0.04;
const CALIBRATION_TOKENS_REMAINING = 971_248_285.32;
const CALIBRATION_TOKENS_OUT = totalSupply - CALIBRATION_TOKENS_REMAINING;
const CALIBRATION_ETH_EFFECTIVE = CALIBRATION_ETH_GROSS * (1 - feeRate);

export const DEFAULT_LIQUIDITY_ESTIMATE = backSolveLiquidityFromSwap(
  CALIBRATION_ETH_EFFECTIVE,
  CALIBRATION_TOKENS_OUT,
  FLOOR_SQRT_P
);

export interface OwnerBuyStep {
  walletIndex: number;
  ethGrossToSend: number;
  tokensOut: number;
  mcAfterUsd: number;
}

export function simulateFromOwnerBuy(params: {
  ownerBuyEth: number;
  walletCount: number;
  targetPctOfSupplyPerWallet: number;
  liquidityL?: number;
  ethPriceUsd: number;
}) {
  const { ownerBuyEth, walletCount, targetPctOfSupplyPerWallet, ethPriceUsd } = params;
  const L = params.liquidityL ?? DEFAULT_LIQUIDITY_ESTIMATE;
  const curve = { liquidity: L, feeRate };

  const floorMcUsd = sqrtPToMarketCapUsd(FLOOR_SQRT_P, totalSupply, ethPriceUsd);

  const { tokensOut: tokensBoughtByOwner, newSqrtP: sqrtPAfterOwnerBuy } =
    simulateBuyExact(ownerBuyEth, FLOOR_SQRT_P, curve);

  const afterOwnerBuyMcUsd = sqrtPToMarketCapUsd(sqrtPAfterOwnerBuy, totalSupply, ethPriceUsd);
  const pctOfSupplyOwnerBought = (tokensBoughtByOwner / totalSupply) * 100;
  const ethReserveAfterOwnerBuy = ownerBuyEth;
  const tokenReserveAfterOwnerBuy = totalSupply - tokensBoughtByOwner;

  const steps: OwnerBuyStep[] = [];
  const targetTokensPerWallet = totalSupply * targetPctOfSupplyPerWallet;
  let sqrtP = sqrtPAfterOwnerBuy;

  for (let w = 0; w < walletCount; w++) {
    const { ethGrossIn, newSqrtP } = ethNeededForExactTokens(targetTokensPerWallet, sqrtP, curve);
    sqrtP = newSqrtP;
    const mcAfterUsd = sqrtPToMarketCapUsd(sqrtP, totalSupply, ethPriceUsd);
    steps.push({ walletIndex: w, ethGrossToSend: ethGrossIn, tokensOut: targetTokensPerWallet, mcAfterUsd });
  }

  return {
    steps,
    floorMcUsd,
    afterOwnerBuyMcUsd,
    pctOfSupplyOwnerBought,
    ethReserveAfterOwnerBuy,
    tokenReserveAfterOwnerBuy,
  };
}
