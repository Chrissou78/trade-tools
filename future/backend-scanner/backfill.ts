// scanner/backfill.ts
import { JsonRpcProvider } from "ethers";
import { DetectedLaunch } from "./types";

const LAUNCH_FACTORY = "0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB";
const LAUNCH_EVENT_TOPIC =
  "0x1461370115e1c2be79cb529f8cfcbd11316e789d9c6099fc83417b0b4c48c62a";

// Scans historical blocks in chunks (RPC providers cap getLogs range,
// typically to a few thousand blocks per call).
export async function backfillLaunches(
  provider: JsonRpcProvider,
  fromBlock: number,
  toBlock: number,
  chunkSize = 2000
): Promise<DetectedLaunch[]> {
  const results: DetectedLaunch[] = [];

  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, toBlock);

    const logs = await provider.getLogs({
      address: LAUNCH_FACTORY,
      topics: [LAUNCH_EVENT_TOPIC],
      fromBlock: start,
      toBlock: end,
    });

    for (const log of logs) {
      const tokenAddress = "0x" + log.topics[1].slice(26);
      const deployer = "0x" + log.topics[2].slice(26);
      const wethAddress = "0x" + log.data.slice(26, 66);

      results.push({
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp: 0,
        tokenAddress,
        deployer,
        wethAddress,
      });
    }
  }

  return results;
}
