// app/launch/page.tsx
"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { BrowserProvider, JsonRpcProvider, Wallet, Contract, parseEther, formatEther, isAddress } from "ethers";
import { generateWalletSet, GeneratedWallet } from "@/lib/wallets/generator";
import { downloadWalletsCsv, parseWalletsCsv } from "@/lib/wallets/csv";
import { findPoolAndState } from "@/lib/dex/pool";
import { planMultiWalletBuy } from "@/lib/dex/planMultiBuy";
import { simulateFromOwnerBuy, DEFAULT_LIQUIDITY_ESTIMATE } from "@/lib/dex/empiricalSim";
import { distributeVariableEth, distributeEth } from "@/lib/batch/sender";
import type { SendResult } from "@/lib/batch/sender";
import { multiBuyVariable } from "@/lib/batch/buyer";
import { prepareWallets, fireSwaps, runPool } from "@/lib/batch/prepareBuy";
import type { PrepareResult, SwapResult } from "@/lib/batch/prepareBuy";
import { ADDRESSES } from "@/lib/chains/robinhood";
import { sellNoxaToken } from "@/lib/dex/sell";
import { getLiveSqrtPrice, sqrtPToMarketCapUsd } from "@/lib/dex/noxaCurve";
import { useEthPrice } from "@/hooks/useEthPrice";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { topUpShortfalls } from "@/lib/batch/topUp";
import { PageHeader, Banner } from "@/components/ui";
import { WalletsSection } from "./sections/WalletsSection";
import { SimulateSection } from "./sections/SimulateSection";
import { FundBuySection } from "./sections/FundBuySection";
import { ManualBatchSection } from "./sections/ManualBatchSection";
import { SellSection } from "./sections/SellSection";
import type {
  StatusMsg, StatusTone, PlanStep, WalletSellConfig, WalletEntry, EmpiricalStats, SimMode, ManualBuyRow,
} from "./types";

// Split "0xabc, 0xdef\n0x123" into a clean address list, keeping only valid ones.
function parseAddressList(raw: string): { valid: string[]; invalid: number } {
  const tokens = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const valid = tokens.filter((a) => isAddress(a));
  return { valid, invalid: tokens.length - valid.length };
}

// A manual buy wraps ETH into WETH and swaps it. Gas for the wrap, approve and
// swap is paid from the wallet's ETH, separate from the amount being swapped.
// So "max buy" is the balance minus a gas reserve, estimated from live gas with
// a floor so a zero/low fee reading never drains the wallet dry.
const GAS_UNITS_FOR_BUY = 320_000n; // wrap + approve + swap, with headroom
const MIN_GAS_RESERVE_WEI = parseEther("0.0003");
const WETH_BALANCE_ABI = ["function balanceOf(address) view returns (uint256)"];

async function readWalletState(provider: JsonRpcProvider, address: string) {
  const weth = new Contract(ADDRESSES.weth, WETH_BALANCE_ABI, provider);
  const [balanceWei, wethWei, feeData] = await Promise.all([
    provider.getBalance(address),
    weth.balanceOf(address) as Promise<bigint>,
    provider.getFeeData(),
  ]);
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  let reserveWei = gasPrice * GAS_UNITS_FOR_BUY;
  if (reserveWei < MIN_GAS_RESERVE_WEI) reserveWei = MIN_GAS_RESERVE_WEI;
  const maxWei = balanceWei > reserveWei ? balanceWei - reserveWei : 0n;
  return { balanceWei, wethWei, reserveWei, maxWei };
}

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

  // Manual load & buy — independent of the generated set (Step 4).
  const [fundList, setFundList] = useState("");
  const [fundAmountEth, setFundAmountEth] = useState(0.02);
  const [fundResults, setFundResults] = useState<SendResult[]>([]);
  const [manualBuyRows, setManualBuyRows] = useState<ManualBuyRow[]>([]);
  const [prepareResults, setPrepareResults] = useState<PrepareResult[]>([]);
  const [manualBuyResults, setManualBuyResults] = useState<SwapResult[]>([]);
  const [fireConcurrency, setFireConcurrency] = useState(2);
  const [slippagePct, setSlippagePct] = useState(50);

  const [signerProvider, setSignerProvider] = useState<BrowserProvider | null>(null);
  const [buyResults, setBuyResults] = useState<WalletEntry[]>([]);
  const [sellConfig, setSellConfig] = useState<Record<string, WalletSellConfig>>({});
  const watcherRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setStatusMsg = (text: string, tone: StatusTone = "info") => setStatus({ text, tone });

  // Trim and validate the token address before it reaches any contract call.
  // A stray space/newline makes ethers try ENS, which this chain lacks, giving
  // a confusing "network does not support ENS" error. Returns null (and warns)
  // when the value is not a clean address.
  const resolveToken = (): string | null => {
    const t = tokenAddress.trim();
    if (!isAddress(t)) {
      setStatusMsg("Enter a valid token address — 0x followed by 40 hex characters, no spaces.", "warning");
      return null;
    }
    return t;
  };

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
    const token = resolveToken();
    if (!token) return;
    if (!ethPriceUsd) return setStatusMsg("Waiting on ETH price feed...", "warning");
    setStatusMsg("Reading pool state on-chain...", "info");
    try {
      const provider = new JsonRpcProvider(HTTP_RPC);
      const poolState = await findPoolAndState(provider, token);
      setPoolAddress(poolState.poolAddress);
      const result = await planMultiWalletBuy(provider, token, poolState.poolAddress, wallets.length || walletCount, 0.96, ethPriceUsd);
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

  // ---- Section 4: manual load & buy (independent of the generated set) ----
  const handleSendEthList = async () => {
    if (!signerProvider) return setStatusMsg("Connect MetaMask first.", "warning");
    const { valid, invalid } = parseAddressList(fundList);
    if (valid.length === 0) return setStatusMsg("Paste at least one valid wallet address.", "warning");
    if (!(fundAmountEth > 0)) return setStatusMsg("Enter an amount greater than 0.", "warning");
    setFundResults([]);
    setStatusMsg(
      `Sending ${fundAmountEth} ETH to ${valid.length} wallet(s)${invalid > 0 ? ` (skipping ${invalid} invalid line(s))` : ""}...`,
      "info"
    );
    try {
      const signer = await signerProvider.getSigner();
      const results = await distributeEth(signer, valid, fundAmountEth.toString());
      setFundResults(results);
      const failed = results.filter((r) => r.status === "failed").length;
      setStatusMsg(
        failed > 0 ? `Sent with ${failed} failure(s).` : `Sent ${fundAmountEth} ETH to all ${valid.length} wallet(s).`,
        failed > 0 ? "warning" : "success"
      );
    } catch (err: any) {
      setStatusMsg(`Send failed: ${err.message}`, "error");
    }
  };

  const handleAddBuyRow = async (privateKey: string): Promise<boolean> => {
    try {
      const provider = new JsonRpcProvider(HTTP_RPC);
      const wallet = new Wallet(privateKey, provider);
      if (manualBuyRows.some((r) => r.address === wallet.address)) {
        setStatusMsg("That wallet is already in the list.", "warning");
        return false;
      }
      setStatusMsg(`Reading balance for ${wallet.address.slice(0, 6)}...`, "info");
      const { balanceWei, wethWei, maxWei } = await readWalletState(provider, wallet.address);
      setManualBuyRows((prev) => [
        ...prev,
        {
          privateKey: wallet.privateKey,
          address: wallet.address,
          balanceEth: formatEther(balanceWei),
          wethEth: formatEther(wethWei),
          maxBuyEth: formatEther(maxWei),
        },
      ]);
      setStatusMsg(`Added ${wallet.address.slice(0, 6)}… — balance ${Number(formatEther(balanceWei)).toFixed(5)} ETH.`, "success");
      return true;
    } catch (err: any) {
      setStatusMsg(`Could not add wallet: ${err.message}`, "error");
      return false;
    }
  };

  const handleRemoveBuyRow = (index: number) =>
    setManualBuyRows((prev) => prev.filter((_, i) => i !== index));

  // Bulk load: paste many private keys at once (one per line, or comma/space
  // separated). Invalid keys and duplicates are skipped; balances are read
  // through the pool so a big paste doesn't flood the RPC.
  const handleLoadKeys = async (raw: string): Promise<number> => {
    const tokens = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (tokens.length === 0) {
      setStatusMsg("Paste at least one private key.", "warning");
      return 0;
    }
    const existing = new Set(manualBuyRows.map((r) => r.address));
    const seen = new Set<string>();
    const valid: { privateKey: string; address: string }[] = [];
    let invalid = 0;
    for (const tok of tokens) {
      try {
        const w = new Wallet(tok);
        if (existing.has(w.address) || seen.has(w.address)) continue;
        seen.add(w.address);
        valid.push({ privateKey: w.privateKey, address: w.address });
      } catch {
        invalid += 1;
      }
    }
    if (valid.length === 0) {
      setStatusMsg(invalid > 0 ? `No new wallets added — ${invalid} key(s) invalid or already loaded.` : "No new wallets to add.", "warning");
      return 0;
    }

    setStatusMsg(`Reading balances for ${valid.length} wallet(s)...`, "info");
    const provider = new JsonRpcProvider(HTTP_RPC);
    const rows = await runPool(valid, 4, async (v) => {
      try {
        const { balanceWei, wethWei, maxWei } = await readWalletState(provider, v.address);
        return { privateKey: v.privateKey, address: v.address, balanceEth: formatEther(balanceWei), wethEth: formatEther(wethWei), maxBuyEth: formatEther(maxWei) };
      } catch {
        return { privateKey: v.privateKey, address: v.address, balanceEth: "0", wethEth: "0", maxBuyEth: "0" };
      }
    });
    setManualBuyRows((prev) => [...prev, ...rows]);
    setStatusMsg(`Loaded ${rows.length} wallet(s)${invalid > 0 ? `, skipped ${invalid} invalid or duplicate` : ""}.`, "success");
    return rows.length;
  };

  const handleRefreshBalances = async () => {
    if (manualBuyRows.length === 0) return;
    setStatusMsg("Refreshing balances...", "info");
    const provider = new JsonRpcProvider(HTTP_RPC);
    const updated = await runPool(manualBuyRows, 4, async (row) => {
      try {
        const { balanceWei, wethWei, maxWei } = await readWalletState(provider, row.address);
        return { ...row, balanceEth: formatEther(balanceWei), wethEth: formatEther(wethWei), maxBuyEth: formatEther(maxWei) };
      } catch {
        return row;
      }
    });
    setManualBuyRows(updated);
    setStatusMsg("Balances refreshed.", "success");
  };

  // Phase 1: wrap + approve ahead of launch, so the launch click is swap-only.
  const handlePrepareWallets = async () => {
    if (manualBuyRows.length === 0) return setStatusMsg("Add at least one wallet first.", "warning");
    const provider = new JsonRpcProvider(HTTP_RPC);
    setStatusMsg("Reading balances before wrapping...", "info");

    const items: { wallet: Wallet; amountWei: bigint }[] = [];
    const skipped: string[] = [];
    for (const row of manualBuyRows) {
      try {
        const wallet = new Wallet(row.privateKey, provider);
        const { maxWei } = await readWalletState(provider, wallet.address);
        if (maxWei <= 0n) { skipped.push(row.address); continue; }
        items.push({ wallet, amountWei: maxWei });
      } catch {
        skipped.push(row.address);
      }
    }

    if (items.length === 0) return setStatusMsg("No wallets have enough balance to wrap after the gas reserve.", "error");
    setPrepareResults([]);
    setStatusMsg(
      skipped.length > 0
        ? `Wrapping + approving ${items.length} wallet(s), skipping ${skipped.length} too low...`
        : `Wrapping + approving ${items.length} wallet(s)...`,
      skipped.length > 0 ? "warning" : "info"
    );

    try {
      const results = await prepareWallets(items, fireConcurrency);
      setPrepareResults(results);
      const failed = results.filter((r) => r.status === "failed").length;
      setStatusMsg(
        failed > 0 ? `Prepared with ${failed} failure(s).` : `Prepared ${items.length} wallet(s). Ready to fire.`,
        failed > 0 ? "warning" : "success"
      );
      await handleRefreshBalances();
    } catch (err: any) {
      setStatusMsg(`Prepare failed: ${err.message}`, "error");
    }
  };

  // Phase 2: fire one swap per wallet, all at once, from each wallet's WETH.
  const handleFireBuys = async () => {
    const token = resolveToken();
    if (!token) return;
    if (manualBuyRows.length === 0) return setStatusMsg("Add at least one wallet first.", "warning");
    setManualBuyResults([]);
    setStatusMsg(`Firing ${manualBuyRows.length} swap(s)...`, "info");
    try {
      const provider = new JsonRpcProvider(HTTP_RPC);
      const wallets = manualBuyRows.map((r) => new Wallet(r.privateKey, provider));
      const slippageBps = Math.round(slippagePct * 100);
      const results = await fireSwaps(wallets, token, slippageBps, 10000, fireConcurrency);
      setManualBuyResults(results);
      const failed = results.filter((r) => r.status === "failed").length;
      setStatusMsg(
        failed > 0 ? `Buys fired with ${failed} failure(s).` : `Buys fired for ${wallets.length} wallet(s).`,
        failed > 0 ? "warning" : "success"
      );
      await handleRefreshBalances();
    } catch (err: any) {
      setStatusMsg(`Fire failed: ${err.message}`, "error");
    }
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
    const token = resolveToken();
    if (!token) return;
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

    const results = await multiBuyVariable(items, token, 500, [300, 1500]);

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
    const token = tokenAddress.trim();
    if (!isAddress(token)) return setStatusMsg("Set a valid token address before selling.", "warning");
    setStatusMsg(`Selling ${cfg.sellPct}% from ${address.slice(0, 8)}...`, "info");
    try {
      const provider = new JsonRpcProvider(HTTP_RPC);
      const wallet = new Wallet(privateKey, provider);
      const outcome = await sellNoxaToken({ wallet, tokenAddress: token, sellPercentage: cfg.sellPct });
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

        <ManualBatchSection
          tokenAddress={tokenAddress}
          onTokenAddressChange={setTokenAddress}
          fundList={fundList}
          onFundListChange={setFundList}
          fundAmountEth={fundAmountEth}
          onFundAmountChange={setFundAmountEth}
          onSendEthList={handleSendEthList}
          fundResults={fundResults}
          manualBuyRows={manualBuyRows}
          onAddBuyRow={handleAddBuyRow}
          onLoadKeys={handleLoadKeys}
          onRemoveBuyRow={handleRemoveBuyRow}
          onRefreshBalances={handleRefreshBalances}
          onPrepareWallets={handlePrepareWallets}
          onFireBuys={handleFireBuys}
          concurrency={fireConcurrency}
          onConcurrencyChange={setFireConcurrency}
          slippagePct={slippagePct}
          onSlippageChange={setSlippagePct}
          prepareResults={prepareResults}
          manualBuyResults={manualBuyResults}
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
