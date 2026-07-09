// app/scanner/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { Wallet, JsonRpcProvider } from "ethers";
import { useNoxaScanner } from "@/hooks/useNoxaScanner";
import { useEthPrice } from "@/hooks/useEthPrice";
import { evaluateEntry, evaluateSellTriggers } from "@/lib/rules/evaluator";
import { EntryConditions, Position } from "@/lib/rules/types";
import { planMultiWalletBuy } from "@/lib/dex/planMultiBuy";
import { multiBuyVariable } from "@/lib/batch/buyer";
import { multiSell } from "@/lib/batch/seller";
import { getLiveSqrtPrice, sqrtPToMarketCapUsd } from "@/lib/dex/noxaCurve";
import { loadWalletsEncrypted } from "@/lib/wallets/storage";
import { ScannerControls } from "@/components/scanner/ScannerControls";
import { ConditionsForm } from "@/components/scanner/ConditionsForm";
import { LaunchFeed } from "@/components/scanner/LaunchFeed";
import { PositionsTable } from "@/components/scanner/PositionsTable";
import { WalletPoolUnlock } from "@/components/scanner/WalletPoolUnlock";

const HTTP_RPC = process.env.NEXT_PUBLIC_ROBINHOOD_HTTP_RPC!;
const WS_RPC = process.env.NEXT_PUBLIC_ROBINHOOD_WS_RPC!;

const DEFAULT_SELL_TRIGGERS = [
  { id: "tp1", type: "take_profit_mc_multiple" as const, value: 2, exitPercentage: 50 },
  { id: "tp2", type: "take_profit_mc_multiple" as const, value: 5, exitPercentage: 100 },
  { id: "sl", type: "stop_loss_mc_drop_pct" as const, value: 40, exitPercentage: 100 },
  { id: "trail", type: "trailing_stop_pct" as const, value: 25, exitPercentage: 100 },
];

export default function ScannerPage() {
  const ethPriceUsd = useEthPrice();
  const { isScanning, launches, start, stop } = useNoxaScanner(WS_RPC, HTTP_RPC, ethPriceUsd ?? 0);

  const [conditions, setConditions] = useState<EntryConditions>({
    enabled: true,
    maxMarketCapAfterFirstBuyUsd: 6000,
    minLiquidity: 20000,
    maxWalletBuyPctOfCap: 0.96,
    walletCount: 5,
    ethBudgetCapTotal: 0.5,
  });

  const [positions, setPositions] = useState<Position[]>([]);
  const [autoExecute, setAutoExecute] = useState(false);

  // Pre-funded wallet pool, unlocked once per session, kept only in memory.
  const [walletPool, setWalletPool] = useState<Wallet[] | null>(null);

  const unlockWalletPool = useCallback(async (password: string) => {
    const stored = await loadWalletsEncrypted(password);
    if (!stored) throw new Error("No saved wallets found for this password.");
    const provider = new JsonRpcProvider(HTTP_RPC);
    const wallets = stored.map((w: any) => new Wallet(w.privateKey, provider));
    setWalletPool(wallets);
  }, []);

  useEffect(() => {
    if (!ethPriceUsd) return;
    launches.forEach((launch) => {
      if (launch.mcAfterFirstBuyUsd == null || launch.liquidity == null) return;
      if (positions.some((p) => p.tokenAddress === launch.tokenAddress)) return;

      const evalResult = evaluateEntry(conditions, launch.mcAfterFirstBuyUsd, launch.liquidity);
      if (evalResult.shouldEnter && autoExecute) {
        if (!walletPool || walletPool.length === 0) {
          console.warn("Auto-execute is on but no wallet pool is unlocked — skipping entry.");
          return;
        }
        executeEntry(launch.tokenAddress, launch.poolAddress!, launch.mcAfterFirstBuyUsd);
      }
    });
  }, [launches, conditions, autoExecute, ethPriceUsd, walletPool]);

  const executeEntry = useCallback(
    async (tokenAddress: string, poolAddress: string, entryMc: number) => {
      if (!walletPool || !ethPriceUsd) return;
      const provider = new JsonRpcProvider(HTTP_RPC);

      // The precise, curve-calibrated sequential plan — one entry per wallet,
      // each accounting for the price impact of every prior wallet's buy.
      const plan = await planMultiWalletBuy(
        provider, tokenAddress, poolAddress, conditions.walletCount, conditions.maxWalletBuyPctOfCap, ethPriceUsd
      );

      const totalPlanned = plan.reduce((sum, s) => sum + s.ethGrossToSend, 0);
      if (totalPlanned > conditions.ethBudgetCapTotal) {
        console.warn(`Plan needs ${totalPlanned.toFixed(4)} ETH, exceeds budget cap ${conditions.ethBudgetCapTotal} — skipping.`);
        return;
      }

      const walletsToUse = walletPool.slice(0, conditions.walletCount);

      // Pair each wallet with its own precise planned amount — no more
      // flattening into an average. Wallet i gets exactly plan[i]'s amount.
      const items = walletsToUse.map((wallet, i) => ({
        wallet,
        ethAmount: plan[i].ethGrossToSend.toFixed(6),
      }));

      const results = await multiBuyVariable(items, tokenAddress, 500, [300, 1500]);

      const successfulWallets = results.filter((r) => r.status === "success").map((r) => r.address);
      if (successfulWallets.length === 0) {
        console.warn(`All buys failed for ${tokenAddress} — not opening a position.`);
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
          sellTriggers: DEFAULT_SELL_TRIGGERS,
          peakMcUsd: entryMc,
        },
      ]);
    },
    [conditions, ethPriceUsd, walletPool]
  );

  const executeSell = useCallback(
    async (position: Position, triggerId: string, exitPercentage: number, reason: string) => {
      if (!walletPool) return;
      const wallets = walletPool.filter((w) => position.walletAddresses.includes(w.address));
      if (wallets.length === 0) return;

      console.log(`Selling ${exitPercentage}% of ${position.tokenAddress}: ${reason}`);
      const results = await multiSell({
        wallets,
        tokenAddress: position.tokenAddress,
        sellPercentage: exitPercentage,
        slippageBps: 500,
      });

      const anyPartial = results.some((r) => r.status === "partial");
      if (anyPartial) {
        console.warn(
          `Some wallets sold successfully but WETH unwrap failed for ${position.tokenAddress} — funds are safe as WETH, needs manual unwrap.`
        );
      }

      setPositions((prev) =>
        prev.map((p) => {
          if (p.tokenAddress !== position.tokenAddress) return p;
          const isFullyClosed = exitPercentage >= 100;
          // Remove the trigger that just fired so it can't re-fire on the
          // same threshold again once price re-crosses it.
          const remainingTriggers = p.sellTriggers.filter((t) => t.id !== triggerId);
          return { ...p, status: isFullyClosed ? "closed" : "open", sellTriggers: remainingTriggers };
        })
      );
    },
    [walletPool]
  );

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
    <div className="max-w-5xl mx-auto py-12 px-6">
      <h1 className="text-xl font-semibold mb-6">Scanner + Auto-Trade Rules</h1>

      <WalletPoolUnlock onUnlock={unlockWalletPool} isUnlocked={!!walletPool} poolSize={walletPool?.length ?? 0} />

      <ScannerControls
        isScanning={isScanning}
        onStart={start}
        onStop={stop}
        autoExecute={autoExecute}
        onToggleAutoExecute={setAutoExecute}
      />

      <ConditionsForm conditions={conditions} onChange={setConditions} />

      <LaunchFeed launches={launches} conditions={conditions} />

      <PositionsTable positions={positions} />
    </div>
  );
}
