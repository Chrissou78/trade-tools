// lib/dex/floorPrice.ts
import { Contract, JsonRpcProvider } from "ethers";

const Q96 = 2 ** 96;

export interface FloorPriceInfo {
  sqrtPriceX96: bigint;
  tick: number;
  floorMcWeth: number;
  floorMcUsd: number;
}

/**
 * Reads the pool's Initialize event to get the exact floor price —
 * the state before any buy (owner's or otherwise) has moved it.
 * This is the true starting point of the curve.
 */
export async function getFloorPriceFromInitialize(
  provider: JsonRpcProvider,
  poolAddress: string,
  totalSupplyRaw: bigint,
  tokenDecimals: number,
  wethIsToken0: boolean,
  ethPriceUsd: number
): Promise<FloorPriceInfo> {
  const pool = new Contract(
    poolAddress,
    ["event Initialize(uint160 sqrtPriceX96, int24 tick)"],
    provider
  );

  const events = await pool.queryFilter(pool.filters.Initialize(), 0, "latest");
  if (events.length === 0) throw new Error("No Initialize event found for this pool.");

  const { sqrtPriceX96, tick } = (events[0] as any).args;

  const sqrtP = Number(sqrtPriceX96) / Q96;
  const rawPrice = sqrtP * sqrtP; // token1 per token0, raw units

  const priceOfTokenInWeth = wethIsToken0 ? rawPrice : 1 / rawPrice;
  const totalSupply = Number(totalSupplyRaw) / 10 ** tokenDecimals;

  const floorMcWeth = priceOfTokenInWeth * totalSupply;
  const floorMcUsd = floorMcWeth * ethPriceUsd;

  return { sqrtPriceX96: BigInt(sqrtPriceX96.toString()), tick: Number(tick), floorMcWeth, floorMcUsd };
}
