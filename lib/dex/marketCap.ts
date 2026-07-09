// lib/dex/marketCap.ts
import { formatEther } from "ethers";
import { simulateBuyExact, CurveCalibration } from "./noxaCurve";

const Q96 = 2 ** 96;

// Converts a pool sqrtPriceX96 into implied fully-diluted market cap in USD.
// wethIsToken0 depends on address sort order — check via pool.token0()/token1().
export function priceToMarketCapUsd(
  sqrtPriceX96: bigint,
  totalSupplyRaw: bigint,
  tokenDecimals: number,
  ethPriceUsd: number,
  wethIsToken0: boolean
): number {
  const sqrtP = Number(sqrtPriceX96) / Q96;
  const rawPrice = sqrtP * sqrtP;

  const priceOfTokenInWeth = wethIsToken0 ? rawPrice : 1 / rawPrice;
  const priceOfTokenInUsd = priceOfTokenInWeth * ethPriceUsd;

  const totalSupply = Number(totalSupplyRaw) / 10 ** tokenDecimals;
  return priceOfTokenInUsd * totalSupply;
}

// Sanity-check / reverse-engineering helper: given the owner's buy amount,
// what market cap should result? Use this against an observed value to
// confirm your calibrated liquidity and starting price are correct.
export function verifyCalibrationAgainstObservedMc(
  ownerBuyEthWei: bigint,
  curve: { liquidity: bigint; sqrtPriceLowerX96: bigint; feeRate?: number },
  totalSupplyRaw: bigint,
  tokenDecimals: number,
  ethPriceUsd: number,
  wethIsToken0: boolean
): { impliedMcUsd: number } {
  // simulateBuyExact expects plain decimal ETH and a plain sqrt-price ratio,
  // not raw wei / X96 fixed-point — convert both before calling it.
  const ethGrossIn = Number(formatEther(ownerBuyEthWei));
  const startingSqrtP = Number(curve.sqrtPriceLowerX96) / Q96;

  const curveCalibration: CurveCalibration = {
    liquidity: Number(curve.liquidity),
    feeRate: curve.feeRate ?? 0.01,
  };

  const { newSqrtP } = simulateBuyExact(ethGrossIn, startingSqrtP, curveCalibration);

  // Convert the plain ratio back to X96 fixed-point so priceToMarketCapUsd
  // (which expects raw sqrtPriceX96) works correctly.
  const newSqrtPriceX96 = BigInt(Math.round(newSqrtP * Q96));

  const impliedMcUsd = priceToMarketCapUsd(
    newSqrtPriceX96,
    totalSupplyRaw,
    tokenDecimals,
    ethPriceUsd,
    wethIsToken0
  );
  return { impliedMcUsd };
}
