// hooks/useNoxaScanner.ts
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { WebSocketProvider, JsonRpcProvider, Contract } from "ethers";
import { getFloorPriceFromInitialize, sqrtPToMarketCapUsd } from "@/lib/dex/noxaCurve";
import { getExactLiquidityFromMint, getLiveSqrtPrice } from "@/lib/dex/noxaCurve";

const LAUNCH_FACTORY = "0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB";
const UNISWAP_FACTORY = "0x1f7d7550b1b028f7571e69a784071f0205fd2efa";
const LAUNCH_EVENT_TOPIC = "0x1461370115e1c2be79cb529f8cfcbd11316e789d9c6099fc83417b0b4c48c62a";

export interface ScannedLaunch {
  txHash: string;
  tokenAddress: string;
  poolAddress: string | null;
  mcAfterFirstBuyUsd: number | null;
  liquidity: number | null;
  detectedAt: number;
}

export function useNoxaScanner(wsRpcUrl: string, httpRpcUrl: string, ethPriceUsd: number) {
  const [isScanning, setIsScanning] = useState(false);
  const [launches, setLaunches] = useState<ScannedLaunch[]>([]);
  const providerRef = useRef<WebSocketProvider | null>(null);

  const start = useCallback(() => {
    if (providerRef.current) return; // already running

    const ws = new WebSocketProvider(wsRpcUrl);
    const http = new JsonRpcProvider(httpRpcUrl);
    providerRef.current = ws;

    ws.on({ address: LAUNCH_FACTORY, topics: [LAUNCH_EVENT_TOPIC] }, async (log) => {
      const tokenAddress = "0x" + log.topics[1].slice(26);
      const wethAddress = "0x" + log.data.slice(26, 66);

      const entry: ScannedLaunch = {
        txHash: log.transactionHash,
        tokenAddress,
        poolAddress: null,
        mcAfterFirstBuyUsd: null,
        liquidity: null,
        detectedAt: Date.now(),
      };
      setLaunches((prev) => [entry, ...prev]);

      // Resolve pool + pull live state for the entry-condition check.
      const factory = new Contract(UNISWAP_FACTORY, ["function getPool(address,address,uint24) view returns (address)"], http);
      for (const fee of [10000, 3000, 500]) {
        const pool = await factory.getPool(tokenAddress, wethAddress, fee);
        if (pool !== "0x0000000000000000000000000000000000000000") {
          const liquidity = Number(await getExactLiquidityFromMint(http, pool));
          const sqrtP = await getLiveSqrtPrice(http, pool);
          const mc = sqrtPToMarketCapUsd(sqrtP, 1_000_000_000, ethPriceUsd);

          setLaunches((prev) =>
            prev.map((l) => (l.txHash === entry.txHash ? { ...l, poolAddress: pool, liquidity, mcAfterFirstBuyUsd: mc } : l))
          );
          break;
        }
      }
    });

    setIsScanning(true);
  }, [wsRpcUrl, httpRpcUrl, ethPriceUsd]);

  const stop = useCallback(() => {
    providerRef.current?.removeAllListeners();
    providerRef.current?.destroy();
    providerRef.current = null;
    setIsScanning(false);
  }, []);

  // Ensures the socket is torn down if the user navigates away —
  // this is the actual enforcement of "scans only while page is open."
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { isScanning, launches, start, stop };
}
