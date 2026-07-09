// lib/dex/pool.ts
import { Contract, JsonRpcProvider } from "ethers";
import { ADDRESSES } from "../chains/robinhood";

const POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function tickSpacing() view returns (int24)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
];

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
];

export interface RawPoolState {
  poolAddress: string;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  tickSpacing: number;
  token0: string;
  token1: string;
}

// Tries fee tiers in order until it finds a real deployed pool.
// NOXA's docs mention 1% (10000) as their default single-sided LP tier,
// but don't assume — verify against the actual token once you have it.
export async function findPoolAndState(
  provider: JsonRpcProvider,
  tokenAddress: string,
  candidateFeeTiers: number[] = [10000, 3000, 500]
): Promise<RawPoolState> {
  const factory = new Contract(ADDRESSES.factory, FACTORY_ABI, provider);

  for (const fee of candidateFeeTiers) {
    const poolAddress = await factory.getPool(ADDRESSES.weth, tokenAddress, fee);
    if (poolAddress === "0x0000000000000000000000000000000000000000") continue;

    const pool = new Contract(poolAddress, POOL_ABI, provider);
    const [slot0, liquidity, tickSpacing, token0, token1] = await Promise.all([
      pool.slot0(),
      pool.liquidity(),
      pool.tickSpacing(),
      pool.token0(),
      pool.token1(),
    ]);

    return {
      poolAddress,
      sqrtPriceX96: slot0.sqrtPriceX96,
      tick: Number(slot0.tick),
      liquidity,
      tickSpacing: Number(tickSpacing),
      token0,
      token1,
    };
  }

  throw new Error(
    "No pool found for this token across candidate fee tiers. Check the fee tier NOXA used at launch on Blockscout."
  );
}
