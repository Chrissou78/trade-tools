// lib/dex/quoter.ts
import { Contract, JsonRpcProvider } from "ethers";
import { ADDRESSES } from "../chains/robinhood";

const QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
  "function quoteExactOutputSingle((address tokenIn,address tokenOut,uint256 amount,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountIn,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
];

// ---- BUY direction: WETH in, token out ----

// "If I put in X ETH, how many tokens do I get" — used for pre-flight
// checks right before executing a buy (buyNoxaTokenProtected).
export async function getQuote(
  provider: JsonRpcProvider,
  tokenOut: string,
  amountIn: bigint,
  feeTier = 10000
): Promise<bigint> {
  const quoter = new Contract(ADDRESSES.quoterV2, QUOTER_ABI, provider);
  const result = await quoter.quoteExactInputSingle.staticCall({
    tokenIn: ADDRESSES.weth,
    tokenOut,
    amountIn,
    fee: feeTier,
    sqrtPriceLimitX96: 0n,
  });
  return result.amountOut as bigint;
}

// "How much ETH do I need to get exactly Y tokens out" — the on-chain,
// authoritative version of the max-wallet sizing question. Use this as
// the final check right before sending, after noxaCurve.ts's closed-form
// math has already told you roughly what to expect.
export async function getEthNeededForExactTokens(
  provider: JsonRpcProvider,
  tokenOut: string,
  desiredTokenAmount: bigint,
  feeTier = 10000
): Promise<{ ethNeeded: bigint; priceImpactWarning: boolean }> {
  const quoter = new Contract(ADDRESSES.quoterV2, QUOTER_ABI, provider);

  const result = await quoter.quoteExactOutputSingle.staticCall({
    tokenIn: ADDRESSES.weth,
    tokenOut,
    amount: desiredTokenAmount,
    fee: feeTier,
    sqrtPriceLimitX96: 0n,
  });

  // Round-trip cross-check: quote the inverse direction with the computed
  // ETH amount and see how far actual output lands from what we asked for.
  const inverseCheck = await quoter.quoteExactInputSingle.staticCall({
    tokenIn: ADDRESSES.weth,
    tokenOut,
    amountIn: result.amountIn,
    fee: feeTier,
    sqrtPriceLimitX96: 0n,
  });

  const deviationBps =
    ((desiredTokenAmount - inverseCheck.amountOut) * 10_000n) / desiredTokenAmount;

  return {
    ethNeeded: result.amountIn,
    priceImpactWarning: deviationBps > 200n, // >2% round-trip deviation = steep curve
  };
}

// ---- SELL direction: token in, WETH out ----

// "If I sell X tokens, how much WETH do I get" — used by sellNoxaToken.
export async function getQuoteReverse(
  provider: JsonRpcProvider,
  tokenIn: string,
  amountIn: bigint,
  feeTier = 10000
): Promise<bigint> {
  const quoter = new Contract(ADDRESSES.quoterV2, QUOTER_ABI, provider);
  const result = await quoter.quoteExactInputSingle.staticCall({
    tokenIn,
    tokenOut: ADDRESSES.weth,
    amountIn,
    fee: feeTier,
    sqrtPriceLimitX96: 0n,
  });
  return result.amountOut as bigint;
}

// "How many tokens do I need to sell to get exactly X WETH out" —
// the sell-side mirror of getEthNeededForExactTokens. Useful if a
// sell trigger targets a specific ETH amount rather than a percentage
// of holdings (e.g. "sell just enough to recover my original cost basis").
export async function getTokensNeededForExactEth(
  provider: JsonRpcProvider,
  tokenIn: string,
  desiredEthAmount: bigint,
  feeTier = 10000
): Promise<{ tokensNeeded: bigint; priceImpactWarning: boolean }> {
  const quoter = new Contract(ADDRESSES.quoterV2, QUOTER_ABI, provider);

  const result = await quoter.quoteExactOutputSingle.staticCall({
    tokenIn,
    tokenOut: ADDRESSES.weth,
    amount: desiredEthAmount,
    fee: feeTier,
    sqrtPriceLimitX96: 0n,
  });

  const inverseCheck = await quoter.quoteExactInputSingle.staticCall({
    tokenIn,
    tokenOut: ADDRESSES.weth,
    amountIn: result.amountIn,
    fee: feeTier,
    sqrtPriceLimitX96: 0n,
  });

  const deviationBps =
    ((desiredEthAmount - inverseCheck.amountOut) * 10_000n) / desiredEthAmount;

  return {
    tokensNeeded: result.amountIn,
    priceImpactWarning: deviationBps > 200n,
  };
}
