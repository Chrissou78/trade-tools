// lib/dex/empiricalSim.ts
import { NOXA_ROBINHOOD_CONSTANTS, simulateBuyExact, planSequentialBuys, CurveCalibration, WalletBuyStep, sqrtPToMarketCapUsd } from "./noxaCurve";

const Q96 = 2 ** 96;

export interface EmpiricalSimInput {
  ownerBuyEth: number;
  walletCount: number;
  targetPctOfSupplyPerWallet: number; // 0.02 = 2%
  liquidityL: number;
  ethPriceUsd: number;
}

export interface EmpiricalSimResult {
  floorMcUsd: number;              // MC at pool creation, before anyone buys
  afterOwnerBuyMcUsd: number;      // MC right after the owner's first buy — your sanity-check number
  tokensOwnerBought: number;
  pctOfSupplyOwnerBought: number;  // owner's buy as % of total supply
  ethReserveAfterOwnerBuy: number; // virtual ETH reserve at that point, for cross-checking
  tokenReserveAfterOwnerBuy: number;
  steps: WalletBuyStep[];
}

export function simulateFromOwnerBuy(input: EmpiricalSimInput): EmpiricalSimResult {
  const floorSqrtP = Number(NOXA_ROBINHOOD_CONSTANTS.floorSqrtPriceX96) / Q96;
  const curve: CurveCalibration = { liquidity: input.liquidityL, feeRate: NOXA_ROBINHOOD_CONSTANTS.feeRate };

  const floorMcUsd = sqrtPToMarketCapUsd(floorSqrtP, NOXA_ROBINHOOD_CONSTANTS.totalSupply, input.ethPriceUsd);

  const ownerStep = simulateBuyExact(input.ownerBuyEth, floorSqrtP, curve);
  const afterOwnerBuyMcUsd = sqrtPToMarketCapUsd(ownerStep.newSqrtP, NOXA_ROBINHOOD_CONSTANTS.totalSupply, input.ethPriceUsd);

  // Virtual reserves at the post-owner-buy price — x = L/sqrtP (ETH side), y = L*sqrtP (token side).
  // Shown so you can eyeball ETH-in-pool / tokens-in-pool directly against the MC figure above.
  const ethReserveAfterOwnerBuy = input.liquidityL / ownerStep.newSqrtP;
  const tokenReserveAfterOwnerBuy = input.liquidityL * ownerStep.newSqrtP;

  const targetTokensPerWallet = NOXA_ROBINHOOD_CONSTANTS.totalSupply * input.targetPctOfSupplyPerWallet;
  const steps = planSequentialBuys(
    input.walletCount,
    targetTokensPerWallet,
    ownerStep.newSqrtP, // wallets buy starting from the price the owner's buy already moved it to
    curve,
    NOXA_ROBINHOOD_CONSTANTS.totalSupply,
    input.ethPriceUsd
  );

  return {
    floorMcUsd,
    afterOwnerBuyMcUsd,
    tokensOwnerBought: ownerStep.tokensOut,
    pctOfSupplyOwnerBought: (ownerStep.tokensOut / NOXA_ROBINHOOD_CONSTANTS.totalSupply) * 100,
    ethReserveAfterOwnerBuy,
    tokenReserveAfterOwnerBuy,
    steps,
  };
}

export const DEFAULT_LIQUIDITY_ESTIMATE = 2_500_000;
