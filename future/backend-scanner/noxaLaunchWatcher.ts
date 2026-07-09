// scanner/noxaLaunchWatcher.ts
import { WebSocketProvider, JsonRpcProvider, Contract, Interface } from "ethers";
import { DetectedLaunch } from "./types";

const LAUNCH_FACTORY = "0xD9eC2db5f3D1b236843925949fe5bd8a3836FCcB";
const UNISWAP_FACTORY = "0x1f7d7550b1b028f7571e69a784071f0205fd2efa";

// The signature observed on-chain across both real launches. Since the
// factory contract isn't verified, we decode by raw topic position rather
// than a named ABI — accurate as long as this signature stays consistent,
// which is worth spot-checking against any new launch you observe.
const LAUNCH_EVENT_TOPIC =
  "0x1461370115e1c2be79cb529f8cfcbd11316e789d9c6099fc83417b0b4c48c62a";

const FACTORY_ABI = ["function getPool(address,address,uint24) view returns (address)"];

function decodeLaunchLog(log: any): DetectedLaunch {
  const tokenAddress = "0x" + log.topics[1].slice(26);
  const deployer = "0x" + log.topics[2].slice(26);
  // data field's first 32 bytes carry the WETH/pair-token address
  const wethAddress = "0x" + log.data.slice(26, 66);

  return {
    txHash: log.transactionHash,
    blockNumber: Number(log.blockNumber),
    timestamp: 0, // filled in by caller after fetching the block
    tokenAddress,
    deployer,
    wethAddress,
  };
}

export interface WatcherOptions {
  wsRpcUrl: string;           // e.g. wss://robinhood-mainnet.g.alchemy.com/v2/{KEY}
  httpRpcUrl: string;         // for the pool lookup + block timestamp fetch
  onLaunchDetected: (launch: DetectedLaunch) => void | Promise<void>;
  candidateFeeTiers?: number[];
}

export async function startNoxaLaunchWatcher(opts: WatcherOptions) {
  const wsProvider = new WebSocketProvider(opts.wsRpcUrl);
  const httpProvider = new JsonRpcProvider(opts.httpRpcUrl);
  const feeTiers = opts.candidateFeeTiers ?? [10000, 3000, 500];

  const filter = {
    address: LAUNCH_FACTORY,
    topics: [LAUNCH_EVENT_TOPIC],
  };

  console.log("NOXA launch watcher started, listening on", LAUNCH_FACTORY);

  wsProvider.on(filter, async (log) => {
    try {
      const launch = decodeLaunchLog(log);

      const block = await httpProvider.getBlock(launch.blockNumber);
      launch.timestamp = block?.timestamp ?? 0;

      // Find the pool: try each fee tier until one resolves.
      const uniFactory = new Contract(UNISWAP_FACTORY, FACTORY_ABI, httpProvider);
      for (const fee of feeTiers) {
        const pool = await uniFactory.getPool(launch.tokenAddress, launch.wethAddress, fee);
        if (pool !== "0x0000000000000000000000000000000000000000") {
          launch.poolAddress = pool;
          launch.feeTier = fee;
          break;
        }
      }

      await opts.onLaunchDetected(launch);
    } catch (err) {
      console.error("Failed to process launch log:", err);
    }
  });

  wsProvider.on("error", (err) => {
    console.error("WebSocket error, will need reconnect logic:", err);
  });

  return { wsProvider, httpProvider };
}
