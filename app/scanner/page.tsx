// app/scanner/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { Wallet, JsonRpcProvider } from "ethers";
import { useNoxaScanner } from "@/hooks/useNoxaScanner";
import { useEthPrice } from "@/hooks/useEthPrice";
import { useTxLog } from "@/hooks/useTxLog";
import { evaluateEntry, evaluateSellTriggers } from "@/lib/rules/evaluator";
import { EntryConditions, Position, SellStrategy, DEFAULT_SELL_STRATEGY } from "@/lib/rules/types";
import { planMultiWalletBuy } from "@/lib/dex/planMultiBuy";
import { multiBuyVariable } from "@/lib/batch/buyer";
import { multiSell } from "@/lib/batch/seller";
import { getLiveSqrtPrice, sqrtPToMarketCapUsd } from "@/lib/dex/noxaCurve";
import { loadWalletsEncrypted } from "@/lib/wallets/storage";
import { ScannerControls } from "@/components/scanner/ScannerControls";
import { ConditionsForm } from "@/components/scanner/ConditionsForm";
import { SellStrategyForm } from "@/components/scanner/SellStrategyForm";
import { LaunchFeed } from "@/components/scanner/LaunchFeed";
import { PositionsTable } from "@/components/scanner/PositionsTable";
import { WalletPoolUnlock } from "@/components/scanner/WalletPoolUnlock";
import { TxLog } from "@/components/TxLog";

const HTTP_RPC = process.env.NEXT_PUBLIC_ROBINHOOD_HTTP_RPC!;
const WS_RPC = process.env.NEXT_PUBLIC_ROBINHOOD_WS_RPC!;

export default function ScannerPage() {
  const ethPriceUsd = useEthPrice();
  const { isScanning, launches, start, stop } = useNoxaScanner(WS_RPC, HTTP_RPC, ethPriceUsd ?? 0);
  const { entries: logEntries, log, clear: clearLog } = useTxLog();

  const [conditions, setConditions] = useState<EntryConditions>({
    enabled: true,
    maxMarketCapAfterFirstBuyUsd: 6000,
    minLiquidity: 20000,
    maxWalletBuyPctOfCap: 0.96,
    walletCount: 5,
    ethBudgetCapTotal: 0.5,
  });

  const [sellStrategy, setSellStrategy] = useState<SellStrategy>(DEFAULT_SELL_STRATEGY);
  const [positions, setPositions] = useState<Position[]>([]);
  const [autoExecute, setAutoExecute] = useState(false);

  // Pre-funded wallet pool, unlocked once per session, kept only in memory.
  const [walletPool, setWalletPool] = useState<Wallet[] | null>(null);

  const unlockWalletPool = useCallback(
    async (password: string) => {
      const stored = await loadWalletsEncrypted(password);
      if (!stored) throw new Error("No saved wallets found for this password.");
      const provider = new JsonRpcProvider(HTTP_RPC);
      const wallets = stored.map((w: any) => new Wallet(w.privateKey, provider));
      setWalletPool(wallets);
      log("info", `Wallet pool unlocked — ${wallets.length} wallets available.`);
    },
    [log]
  );

  const executeEntry = useCallback(
    async (tokenAddress: string, poolAddress: string, entryMc: number) => {
      if (!walletPool || !ethPriceUsd) return;
      const provider = new JsonRpcProvider(HTTP_RPC);

      log("info", `Launch matched entry rules — planning buy for ${tokenAddress.slice(0, 10)}...`, { tokenAddress });

      // Precise, curve-calibrated sequential plan — one entry per wallet,
      // each accounting for the price impact of every prior wallet's buy.
      const plan = await planMultiWalletBuy(
        provider, tokenAddress, poolAddress, conditions.walletCount, conditions.maxWalletBuyPctOfCap, ethPriceUsd
      );

      const totalPlanned = plan.reduce((sum, s) => sum + s.ethGrossToSend, 0);
      if (totalPlanned > conditions.ethBudgetCapTotal) {
        log(
          "warning",
          `Plan needs ${totalPlanned.toFixed(4)} ETH, exceeds budget cap ${conditions.ethBudgetCapTotal} ETH — skipping entry.`,
          { tokenAddress }
        );
        return;
      }

      const walletsToUse = walletPool.slice(0, conditions.walletCount);

      // Each wallet gets its own precise planned amount — plan[i], not an
      // average across the batch.
      const items = walletsToUse.map((wallet, i) => ({
        wallet,
        ethAmount: plan[i].ethGrossToSend.toFixed(6),
      }));

      const results = await multiBuyVariable(items, tokenAddress, 500, [300, 1500]);

      results.forEach((r) => {
        if (r.status === "success") {
          log("success", `Buy succeeded for ${tokenAddress.slice(0, 10)}...`, {
            tokenAddress, walletAddress: r.address, txHash: r.txHash,
          });
        } else {
          log("error", `Buy failed: ${r.error}`, { tokenAddress, walletAddress: r.address });
        }
      });

      const successfulWallets = results.filter((r) => r.status === "success").map((r) => r.address);
      if (successfulWallets.length === 0) {
        log("error", `All buys failed for ${tokenAddress.slice(0, 10)}... — position not opened.`, { tokenAddress });
        return;
      }

      setPositions((prev) => [
        ...prev,
        {
          tokenAddress,
          poolAddress,
          entryTxHashes: results.filter((r) => r.txHash).map((r) => r.txHash!),
          entryMcUsd: entryMc,
          entryTimestamp: Date.now(),
          walletAddresses: successfulWallets,
          tokensHeld: {},
          status: "open",
          sellTriggers: sellStrategy.triggers, // snapshot of the current strategy at entry time
          peakMcUsd: entryMc,
        },
      ]);
    },
    [conditions, ethPriceUsd, walletPool, log, sellStrategy]
  );

  // Fires whenever a launch's on-chain data resolves.
  useEffect(() => {
    if (!ethPriceUsd) return;
    launches.forEach((launch) => {
      if (launch.mcAfterFirstBuyUsd == null || launch.liquidity == null) return;
      if (positions.some((p) => p.tokenAddress === launch.tokenAddress)) return;

      const evalResult = evaluateEntry(conditions, launch.mcAfterFirstBuyUsd, launch.liquidity);
      if (evalResult.shouldEnter && autoExecute) {
        if (!walletPool || walletPool.length === 0) {
          log("warning", "Auto-execute is on but no wallet pool is unlocked — skipping entry.", {
            tokenAddress: launch.tokenAddress,
          });
          return;
        }
        executeEntry(launch.tokenAddress, launch.poolAddress!, launch.mcAfterFirstBuyUsd);
      }
    });
  }, [launches, conditions, autoExecute, ethPriceUsd, walletPool, executeEntry, log]);

  const executeSell = useCallback(
    async (position: Position, triggerId: string, exitPercentage: number, reason: string) => {
      if (!walletPool) return;
      const wallets = walletPool.filter((w) => position.walletAddresses.includes(w.address));
      if (wallets.length === 0) return;

      log("info", `Sell trigger fired for ${position.tokenAddress.slice(0, 10)}...: ${reason}`, {
        tokenAddress: position.tokenAddress,
      });

      const results = await multiSell({
        wallets,
        tokenAddress: position.tokenAddress,
        sellPercentage: exitPercentage,
        slippageBps: 500,
      });

      results.forEach((r) => {
        if (r.status === "success") {
          log("success", `Sold ${exitPercentage}% successfully.`, {
            tokenAddress: position.tokenAddress, walletAddress: r.address, txHash: r.txHash,
          });
        } else if (r.status === "partial") {
          log(
            "warning",
            `Sale succeeded but WETH unwrap failed — wallet is holding WETH, not ETH. Manual unwrap needed. (${r.error})`,
            { tokenAddress: position.tokenAddress, walletAddress: r.address, txHash: r.txHash }
          );
        } else {
          log("error", `Sell failed: ${r.error}`, { tokenAddress: position.tokenAddress, walletAddress: r.address });
        }
      });

      setPositions((prev) =>
        prev.map((p) => {
          if (p.tokenAddress !== position.tokenAddress) return p;
          const isFullyClosed = exitPercentage >= 100;
          // Remove only the trigger that fired, so a partial exit stays
          // open and won't re-fire the same threshold again.
          const remainingTriggers = p.sellTriggers.filter((t) => t.id !== triggerId);
          return { ...p, status: isFullyClosed ? "closed" : "open", sellTriggers: remainingTriggers };
        })
      );
    },
    [walletPool, log]
  );

  // Independent polling loop for sell-trigger monitoring across open positions.
  useEffect(() => {
    if (!ethPriceUsd) return;
    const openPositions = positions.filter((p) => p.status === "open");
    if (openPositions.length === 0) return;

    const interval = setInterval(async () => {
      const provider = new JsonRpcProvider(HTTP_RPC);
      for (const position of openPositions) {
        const sqrtP = await getLiveSqrtPrice(provider, position.poolAddress);
        const currentMc = sqrtPToMarketCapUsd(sqrtP, 1_000_000_000, ethPriceUsd);

        const sellEval = evaluateSellTriggers(position, currentMc);
        if (sellEval.shouldSell && sellEval.triggerId && sellEval.exitPercentage != null) {
          await executeSell(position, sellEval.triggerId, sellEval.exitPercentage, sellEval.reason ?? "trigger fired");
        } else {
          setPositions((prev) =>
            prev.map((p) => (p.tokenAddress === position.tokenAddress ? { ...p, peakMcUsd: Math.max(p.peakMcUsd, currentMc) } : p))
          );
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [positions, ethPriceUsd, executeSell]);

  return (
    <div className="max-w-5xl mx-auto py-12 px-6 space-y-6">
      <h1 className="text-xl font-semibold">Scanner + Auto-Trade Rules</h1>

      <WalletPoolUnlock onUnlock={unlockWalletPool} isUnlocked={!!walletPool} poolSize={walletPool?.length ?? 0} />

      <ScannerControls
        isScanning={isScanning}
        onStart={start}
        onStop={stop}
        autoExecute={autoExecute}
        onToggleAutoExecute={setAutoExecute}
      />

      <ConditionsForm conditions={conditions} onChange={setConditions} />

      <SellStrategyForm strategy={sellStrategy} onChange={setSellStrategy} />

      <LaunchFeed launches={launches} conditions={conditions} />

      <PositionsTable positions={positions} />

      <TxLog entries={logEntries} onClear={clearLog} />
    </div>
  );
}
