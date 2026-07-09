// lib/dex/marketCap.ts
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
  const rawPrice = sqrtP * sqrtP; // price of token1 in terms of token0

  // priceOfTokenInWeth = tokens per WETH or WETH per token, depending on ordering
  const priceOfTokenInWeth = wethIsToken0 ? rawPrice : 1 / rawPrice;
  const priceOfTokenInUsd = priceOfTokenInWeth * ethPriceUsd;

  const totalSupply = Number(totalSupplyRaw) / 10 ** tokenDecimals;
  return priceOfTokenInUsd * totalSupply;
}

// Sanity-check / reverse-engineering helper: given the owner's buy amount,
// what market cap should result? Use this against the observed $2.4k
// to confirm your calibrated L and P_lower are correct.
export function verifyCalibrationAgainstObservedMc(
  ownerBuyEthWei: bigint,
  curve: { liquidity: bigint; sqrtPriceLowerX96: bigint },
  totalSupplyRaw: bigint,
  tokenDecimals: number,
  ethPriceUsd: number,
  wethIsToken0: boolean
): { impliedMcUsd: number } {
  // Reuses simulateBuyExact from before, starting at P_lower since this
  // models the raw creation state before the owner's buy.
  const step = simulateBuyExact(ownerBuyEthWei, curve.sqrtPriceLowerX96, curve as any);
  const impliedMcUsd = priceToMarketCapUsd(
    step.newSqrtPriceX96,
    totalSupplyRaw,
    tokenDecimals,
    ethPriceUsd,
    wethIsToken0
  );
  return { impliedMcUsd };
}
