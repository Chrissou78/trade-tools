// app/launch/page.tsx
"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { BrowserProvider, JsonRpcProvider, Wallet, parseEther } from "ethers";
import { generateWalletSet, GeneratedWallet } from "@/lib/wallets/generator";
import { downloadWalletsCsv, parseWalletsCsv } from "@/lib/wallets/csv";
import { findPoolAndState } from "@/lib/dex/pool";
import { planMultiWalletBuy } from "@/lib/dex/planMultiBuy";
import { simulateFromOwnerBuy, DEFAULT_LIQUIDITY_ESTIMATE } from "@/lib/dex/empiricalSim";
import { distributeVariableEth } from "@/lib/batch/sender";
import { multiBuyVariable } from "@/lib/batch/buyer";
import { sellNoxaToken } from "@/lib/dex/sell";
import { getLiveSqrtPrice, sqrtPToMarketCapUsd } from "@/lib/dex/noxaCurve";
import { useEthPrice } from "@/hooks/useEthPrice";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { topUpShortfalls } from "@/lib/batch/topUp";
import { PageHeader, Banner } from "@/components/ui";
import { WalletsSection } from "./sections/WalletsSection";
import { SimulateSection } from "./sections/SimulateSection";
import { FundBuySection } from "./sections/FundBuySection";
import { SellSection } from "./sections/SellSection";
import type {
  StatusMsg, StatusTone, PlanStep, WalletSellConfig, WalletEntry, EmpiricalStats, SimMode,
} from "./types";

const HTTP_RPC = process.env.NEXT_PUBLIC_ROBINHOOD_HTTP_RPC!;

export default function LaunchPage() {
  const ethPriceUsd = useEthPrice();
  const [tokenAddress, setTokenAddress] = useState("");
  const [walletCount, setWalletCount] = useState(5);
  const [mnemonic, setMnemonic] = useState("");
  const [wallets, setWallets] = useState<GeneratedWallet[]>([]);
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [simMode, setSimMode] = useState<SimMode>("empirical");
  const [ownerBuyEth, setOwnerBuyEth] = useState(0.45);
  const [liquidityL, setLiquidityL] = useState(DEFAULT_LIQUIDITY_ESTIMATE);
  const [plan, setPlan] = useState<PlanStep[] | null>(null);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [empiricalStats, setEmpiricalStats] = useState<EmpiricalStats | null>(null);

  // Manual common buy amount applied to every wallet (Step 3).
  const [commonBuyEth, setCommonBuyEth] = useState(0.02);

  const [signerProvider, setSignerProvider] = useState<BrowserProvider | null>(null);
  const [buyResults, setBuyResults] = useState<WalletEntry[]>([]);
  const [sellConfig, setSellConfig] = useState<Record<string, WalletSellConfig>>({});
  const watcherRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setStatusMsg = (text: string, tone: StatusTone = "info") => setStatus({ text, tone });

  // ---- Section 1: wallets ----
  const handleGenerate = () => {
    const { mnemonic: m, wallets: w } = generateWalletSet(walletCount);
    setMnemonic(m);
    setWallets(w);
    setStatusMsg(`Generated ${w.length} wallets. Save to CSV before leaving this page.`, "warning");
  };

  const handleSaveCsv = () => {
    if (wallets.length === 0) return setStatusMsg("Generate wallets first.", "warning");
    downloadWalletsCsv(mnemonic, wallets, `wallets-${Date.now()}.csv`);
    setStatusMsg("Wallets exported to CSV. Store this file safely and delete it once migrated.", "warning");
  };

  const handleLoadClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const { mnemonic: m, wallets: w } = parseWalletsCsv(text);
      setMnemonic(m);
      setWallets(w);
      setStatusMsg(`Loaded ${w.length} wallet(s) from CSV.`, "success");
    } catch (err: any) {
      setStatusMsg(`Failed to load CSV: ${err.message}`, "error");
    }
  };

  // ---- Section 2: simulate ----
  const handleSimulateEmpirical = () => {
    if (!ethPriceUsd) return setStatusMsg("Waiting on ETH price feed...", "warning");
    const result = simulateFromOwnerBuy({
      ownerBuyEth,
      walletCount: wallets.length || walletCount,
      targetPctOfSupplyPerWallet: 0.02,
      liquidityL,
      ethPriceUsd,
    });
    setPlan(result.steps.map((s) => ({ walletIndex: s.walletIndex, ethGrossToSend: s.ethGrossToSend, mcAfterUsd: s.mcAfterUsd })));
    setEmpiricalStats({
      floorMcUsd: result.floorMcUsd,
      afterOwnerBuyMcUsd: result.afterOwnerBuyMcUsd,
      pctOfSupplyOwnerBought: result.pctOfSupplyOwnerBought,
      ethReserveAfterOwnerBuy: result.ethReserveAfterOwnerBuy,
      tokenReserveAfterOwnerBuy: result.tokenReserveAfterOwnerBuy,
    });
    setStatusMsg(`Owner buy moves MC to $${result.afterOwnerBuyMcUsd.toFixed(0)} — wallets simulated from there.`, "info");
  };

  const handleSimulateLive = async () => {
    if (!tokenAddress) return setStatusMsg("Enter a token address for live simulation.", "warning");
    if (!ethPriceUsd) return setStatusMsg("Waiting on ETH price feed...", "warning");
    setStatusMsg("Reading pool state on-chain...", "info");
    try {
      const provider = new JsonRpcProvider(HTTP_RPC);
      const poolState = await findPoolAndState(provider, tokenAddress);
      setPoolAddress(poolState.poolAddress);
      const result = await planMultiWalletBuy(provider, tokenAddress, poolState.poolAddress, wallets.length || walletCount, 0.96, ethPriceUsd);
      setPlan(result.map((s: any) => ({ walletIndex: s.walletIndex, ethGrossToSend: s.ethGrossToSend, mcAfterUsd: s.mcAfterUsd })));
      setEmpiricalStats(null);
      setStatusMsg(`Live simulation ready — total ${result.reduce((s: number, r: any) => s + r.ethGrossToSend, 0).toFixed(4)} ETH.`, "success");
    } catch (err: any) {
      setStatusMsg(`Simulation failed: ${err.message}`, "error");
    }
  };

  // ---- Section 3: apply a single common amount to every wallet ----
  const handleApplyCommon = () => {
    if (wallets.length === 0) return setStatusMsg("Generate or load wallets first.", "warning");
    if (!(commonBuyEth > 0)) return setStatusMsg("Enter a buy amount greater than 0.", "warning");
    const flatPlan: PlanStep[] = wallets.map((_, i) => ({
      walletIndex: i,
      ethGrossToSend: commonBuyEth,
      mcAfterUsd: 0, // manual amount — market cap not modelled
    }));
    setPlan(flatPlan);
    setEmpiricalStats(null);
    const total = commonBuyEth * wallets.length;
    setStatusMsg(`Applied ${commonBuyEth} ETH to all ${wallets.length} wallet(s) — total ${total.toFixed(4)} ETH. Fund & buy now use this flat amount.`, "success");
  };

  // ---- Section 3: fund + buy ----
  const handleFund = async () => {
    if (!plan || wallets.length === 0) return setStatusMsg("Run a simulation or apply a common amount first.", "warning");
    if (!signerProvider) return setStatusMsg("Connect MetaMask first.", "warning");
    setStatusMsg("Funding wallets...", "info");
    const signer = await signerProvider.getSigner();
    const items = wallets.map((w, i) => ({ address: w.address, amountWei: parseEther((plan[i].ethGrossToSend * 1.03).toFixed(6)) }));
    const results = await distributeVariableEth(signer, items);
    const failed = results.filter((r) => r.status === "failed").length;
    setStatusMsg(failed > 0 ? `Funded with ${failed} failure(s).` : "All wallets funded.", failed > 0 ? "warning" : "success");
  };

  const handleBuy = async () => {
    if (!plan || wallets.length === 0) return setStatusMsg("Run a simulation or apply a common amount first.", "warning");
    if (!tokenAddress) return setStatusMsg("Token address is required to execute buys.", "warning");
    if (!signerProvider) return setStatusMsg("Connect MetaMask first — it may be needed to cover shortfalls.", "warning");

    setStatusMsg("Checking wallet balances before buying...", "info");
    const provider = new JsonRpcProvider(HTTP_RPC);

    const topUps = await topUpShortfalls(
      provider,
      signerProvider,
      wallets.map((w, i) => ({ address: w.address, ethAmountNeeded: plan[i].ethGrossToSend }))
    );

    const failedTopUps = topUps.filter((t) => t.status === "failed");
    if (failedTopUps.length > 0) {
      setStatusMsg(`Top-up failed for ${failedTopUps.length} wallet(s) — aborting buy for those. Check MetaMask balance.`, "error");
    }

    const fundedAddresses = new Set(topUps.filter((t) => t.status !== "failed").map((t) => t.address));

    setStatusMsg("Executing buys...", "info");
    const items = wallets
      .filter((w) => fundedAddresses.has(w.address))
      .map((w) => {
        const i = wallets.findIndex((x) => x.address === w.address);
        return { wallet: new Wallet(w.privateKey, provider), ethAmount: plan[i].ethGrossToSend.toFixed(6) };
      });

    if (items.length === 0) {
      setStatusMsg("No funded wallets to buy with — top-up failed for all.", "error");
      return;
    }

    const results = await multiBuyVariable(items, tokenAddress, 500, [300, 1500]);

    const withEntry: WalletEntry[] = [];
    for (const r of results) {
      if (r.status === "success" && poolAddress) {
        try {
          const sqrtP = await getLiveSqrtPrice(provider, poolAddress);
          withEntry.push({ ...r, entryMcUsd: sqrtPToMarketCapUsd(sqrtP, 1_000_000_000, ethPriceUsd ?? 0) });
        } catch { withEntry.push(r); }
      } else {
        withEntry.push(r);
      }
    }
    setBuyResults(withEntry);
    setSellConfig((prev) => {
      const next = { ...prev };
      withEntry.forEach((r) => { if (!next[r.address]) next[r.address] = { sellPct: 100, gainThreshold: 2, autoSell: false }; });
      return next;
    });
    setStatusMsg("Buys complete — configure sells below.", "success");
  };

  // ---- Section 4: sell per wallet ----
  const handleSellConfigChange = (address: string, cfg: WalletSellConfig) =>
    setSellConfig((p) => ({ ...p, [address]: cfg }));

  const handleSellWallet = useCallback(async (address: string, privateKey: string) => {
    const cfg = sellConfig[address];
    if (!cfg) return;
    setStatusMsg(`Selling ${cfg.sellPct}% from ${address.slice(0, 8)}...`, "info");
    try {
      const provider = new JsonRpcProvider(HTTP_RPC);
      const wallet = new Wallet(privateKey, provider);
      const outcome = await sellNoxaToken({ wallet, tokenAddress, sellPercentage: cfg.sellPct });
      setStatusMsg(
        outcome.status === "success"
          ? `Sold ${cfg.sellPct}% from ${address.slice(0, 8)}...`
          : `Sale succeeded but WETH unwrap failed for ${address.slice(0, 8)}... (${outcome.unwrapError})`,
        outcome.status === "success" ? "success" : "warning"
      );
      setSellConfig((prev) => ({ ...prev, [address]: { ...prev[address], autoSell: false } }));
    } catch (err: any) {
      setStatusMsg(`Sell failed for ${address.slice(0, 8)}...: ${err.message}`, "error");
    }
  }, [sellConfig, tokenAddress]);

  useEffect(() => {
    const anyAuto = buyResults.some((r) => sellConfig[r.address]?.autoSell);
    if (!anyAuto || !poolAddress) {
      if (watcherRef.current) clearInterval(watcherRef.current);
      return;
    }
    watcherRef.current = setInterval(async () => {
      const provider = new JsonRpcProvider(HTTP_RPC);
      const sqrtP = await getLiveSqrtPrice(provider, poolAddress);
      const currentMc = sqrtPToMarketCapUsd(sqrtP, 1_000_000_000, ethPriceUsd ?? 0);

      for (const r of buyResults) {
        const cfg = sellConfig[r.address];
        if (!cfg?.autoSell || !r.entryMcUsd) continue;
        const multiple = currentMc / r.entryMcUsd;
        if (multiple >= cfg.gainThreshold) {
          const w = wallets.find((w) => w.address === r.address);
          if (w) await handleSellWallet(r.address, w.privateKey);
        }
      }
    }, 5000);
    return () => { if (watcherRef.current) clearInterval(watcherRef.current); };
  }, [buyResults, sellConfig, poolAddress, ethPriceUsd, wallets, handleSellWallet]);

  return (
    <div className="min-h-screen w-full">
      <PageHeader
        title="Launch Buyer"
        subtitle="Generate wallets, simulate the launch curve, fund and buy in one flow"
        right={<WalletConnectButton onConnected={(_, provider) => setSignerProvider(provider)} />}
      />

      <div className="w-full max-w-7xl mx-auto px-6 sm:px-12 py-12 space-y-12">
        {status && <Banner tone={status.tone}>{status.text}</Banner>}

        <WalletsSection
          walletCount={walletCount}
          onWalletCountChange={setWalletCount}
          mnemonic={mnemonic}
          wallets={wallets}
          fileInputRef={fileInputRef}
          onGenerate={handleGenerate}
          onSaveCsv={handleSaveCsv}
          onLoadClick={handleLoadClick}
          onFileSelected={handleFileSelected}
        />

        <SimulateSection
          simMode={simMode}
          onSimModeChange={setSimMode}
          ownerBuyEth={ownerBuyEth}
          onOwnerBuyEthChange={setOwnerBuyEth}
          liquidityL={liquidityL}
          onLiquidityLChange={setLiquidityL}
          tokenAddress={tokenAddress}
          onTokenAddressChange={setTokenAddress}
          onSimulateEmpirical={handleSimulateEmpirical}
          onSimulateLive={handleSimulateLive}
          empiricalStats={empiricalStats}
          plan={plan}
          wallets={wallets}
        />

        <FundBuySection
          tokenAddress={tokenAddress}
          onTokenAddressChange={setTokenAddress}
          commonBuyEth={commonBuyEth}
          onCommonBuyEthChange={setCommonBuyEth}
          onApplyCommon={handleApplyCommon}
          walletCount={wallets.length}
          onFund={handleFund}
          onBuy={handleBuy}
        />

        <SellSection
          wallets={wallets}
          sellConfig={sellConfig}
          onSellConfigChange={handleSellConfigChange}
          onSellWallet={handleSellWallet}
        />
      </div>
    </div>
  );
}
