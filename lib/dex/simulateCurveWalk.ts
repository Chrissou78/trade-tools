// lib/dex/simulateCurveWalk.ts
import { Contract, JsonRpcProvider } from "ethers";
import { ADDRESSES } from "../chains/robinhood";

const POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
];

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
];

/**
 * Fetches the real pool address and current state once. This is the
 * starting point for a proper sequential curve simulation — the actual
 * step-by-step swap math (accounting for tick-crossing as reserves
 * deplete) is the part that needs care: a single active-liquidity-range
 * approximation is fine as a rough MVP estimate, but if the buy pushes
 * price across a tick boundary the real cost curves upward faster than
 * a naive constant-liquidity model predicts.
 */
export async function getPoolState(provider: JsonRpcProvider, tokenAddress: string, feeTier = 10000) {
  const factory = new Contract(ADDRESSES.factory, FACTORY_ABI, provider);
  const poolAddress = await factory.getPool(ADDRESSES.weth, tokenAddress, feeTier);

  if (poolAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(`No pool found for this token at fee tier ${feeTier}. Check the fee tier NOXA used at launch.`);
  }

  const pool = new Contract(poolAddress, POOL_ABI, provider);
  const [slot0, liquidity] = await Promise.all([pool.slot0(), pool.liquidity()]);

  return { poolAddress, sqrtPriceX96: slot0.sqrtPriceX96, tick: slot0.tick, liquidity };
}
