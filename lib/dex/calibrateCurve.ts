// lib/dex/calibrateCurve.ts
import { Contract, JsonRpcProvider } from "ethers";

const POOL_ABI = [
  "event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
];

export interface CurveConstants {
  liquidity: bigint;      // L
  tickLower: number;
  tickUpper: number;
  sqrtPriceLowerX96: bigint;
  sqrtPriceUpperX96: bigint;
}

// Run this ONCE against any live NOXA token on Robinhood Chain to
// derive the reusable curve template, assuming NOXA standardizes it.
export async function calibrateFromExistingPool(
  provider: JsonRpcProvider,
  poolAddress: string
): Promise<CurveConstants> {
  const pool = new Contract(poolAddress, POOL_ABI, provider);

  // The position's Mint event fired at pool creation carries the exact
  // liquidity amount and tick bounds NOXA's factory used.
  const filter = pool.filters.Mint();
  const events = await pool.queryFilter(filter, 0, "latest");
  if (events.length === 0) throw new Error("No Mint event found — check pool address.");

  const mintEvent = events[0] as any;
  const { tickLower, tickUpper, amount } = mintEvent.args;

  const sqrtPriceLowerX96 = tickToSqrtPriceX96(Number(tickLower));
  const sqrtPriceUpperX96 = tickToSqrtPriceX96(Number(tickUpper));

  return {
    liquidity: BigInt(amount.toString()),
    tickLower: Number(tickLower),
    tickUpper: Number(tickUpper),
    sqrtPriceLowerX96,
    sqrtPriceUpperX96,
  };
}

// Standard tick-to-sqrtPriceX96 conversion (1.0001^tick, in Q96 format).
function tickToSqrtPriceX96(tick: number): bigint {
  const sqrtPrice = Math.pow(1.0001, tick / 2);
  return BigInt(Math.floor(sqrtPrice * 2 ** 96));
}
