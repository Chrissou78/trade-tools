// lib/dex/planMultiBuy.ts
import { JsonRpcProvider } from "ethers";
import { NOXA_ROBINHOOD_CONSTANTS, getExactLiquidityFromMint, getLiveSqrtPrice, planSequentialBuys } from "./noxaCurve";
import { discoverTokenLimits } from "./tokenLimits";

export async function planMultiWalletBuy(
  provider: JsonRpcProvider,
  tokenAddress: string,
  poolAddress: string,
  walletCount: number,
  targetPctOfMaxWallet: number,
  ethPriceUsd: number
) {
  const limits = await discoverTokenLimits(provider, tokenAddress);
  if (!limits.maxWalletTokens) throw new Error("Could not read max-wallet limit from contract.");

  // Prefer exact Mint-event liquidity; only back-solve as a last resort.
  const liquidity = Number(await getExactLiquidityFromMint(provider, poolAddress));

  // Live price reflects any buys (owner's, other snipers') that already landed.
  const currentSqrtP = await getLiveSqrtPrice(provider, poolAddress);

  const targetPerWallet =
    (Number(limits.maxWalletTokens) / 10 ** limits.decimals) * targetPctOfMaxWallet;

  const plan = planSequentialBuys(
    walletCount,
    targetPerWallet,
    currentSqrtP,
    { liquidity, feeRate: NOXA_ROBINHOOD_CONSTANTS.feeRate },
    NOXA_ROBINHOOD_CONSTANTS.totalSupply,
    ethPriceUsd
  );

  return plan;
}
