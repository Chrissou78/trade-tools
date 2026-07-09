// future/backend-scanner/runner.ts
import { startNoxaLaunchWatcher } from "./noxaLaunchWatcher";
import { getFloorPriceFromInitialize } from "../../lib/dex/floorPrice";
import { getExactLiquidityFromMint } from "../../lib/dex/noxaCurve";
import { JsonRpcProvider } from "ethers";
import fs from "fs";

const httpRpcUrl = process.env.ROBINHOOD_RPC_HTTP!;
const wsRpcUrl = process.env.ROBINHOOD_RPC_WS!;

async function main() {
  await startNoxaLaunchWatcher({
    wsRpcUrl,
    httpRpcUrl,
    onLaunchDetected: async (launch) => {
      console.log("New NOXA launch detected:", launch.tokenAddress);

      if (!launch.poolAddress) {
        console.warn("Pool not found yet for", launch.tokenAddress, "- may need a retry/delay.");
        return;
      }

      const provider = new JsonRpcProvider(httpRpcUrl);
      const liquidity = await getExactLiquidityFromMint(provider, launch.poolAddress);

      const record = {
        ...launch,
        liquidity: liquidity.toString(),
        detectedAt: new Date().toISOString(),
      };

      // Simplest possible persistence for an MVP — append to a JSON log.
      // Swap for a real DB or push over SSE/webhook once this matters more.
      fs.appendFileSync("launches.jsonl", JSON.stringify(record) + "\n");

      // TODO: trigger Telegram/Discord alert here, and/or auto-kick-off
      // planMultiWalletBuy() if you want this to feed straight into
      // your rules-engine auto-trading down the line.
    },
  });
}

main().catch(console.error);
