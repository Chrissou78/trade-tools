// app/launch/page.tsx
"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { BrowserProvider, JsonRpcProvider, Wallet, parseEther } from "ethers";
import { Wallet as WalletIcon, LineChart, Rocket, Target, ShieldAlert, Upload, Download } from "lucide-react";
import { generateWalletSet, GeneratedWallet } from "@/lib/wallets/generator";
import { downloadWalletsCsv, parseWalletsCsv } from "@/lib/wallets/csv";
import { findPoolAndState } from "@/lib/dex/pool";
import { planMultiWalletBuy } from "@/lib/dex/planMultiBuy";
import { simulateFromOwnerBuy, DEFAULT_LIQUIDITY_ESTIMATE } from "@/lib/dex/empiricalSim";
import { distributeVariableEth } from "@/lib/batch/sender";
import { multiBuyVariable, BuyResult } from "@/lib/batch/buyer";
import { sellNoxaToken } from "@/lib/dex/sell";
import { getLiveSqrtPrice, sqrtPToMarketCapUsd } from "@/lib/dex/noxaCurve";
import { useEthPrice } from "@/hooks/useEthPrice";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { topUpShortfalls } from "@/lib/batch/topUp";
import {
  PageHeader, StepCard, Field, Input, Button, StatBox, Banner, Toggle, AddressChip, SecretField,
} from "@/components/ui";

const HTTP_RPC = process.env.NEXT_PUBLIC_ROBINHOOD_HTTP_RPC!;

interface PlanStep { walletIndex: number; ethGrossToSend: number; mcAfterUsd: number }
interface WalletSellConfig { sellPct: number; gainThreshold: number; autoSell: boolean }
interface WalletEntry extends BuyResult { entryMcUsd?: number }

export default function LaunchPage() {
  const ethPriceUsd = useEthPrice();
  const [tokenAddress, setTokenAddress] = useState("");
  const [walletCount, setWalletCount] = useState(5);
  const [mnemonic, setMnemonic] = useState("");
  const [wallets, setWallets] = useState<GeneratedWallet[]>([]);
  const [status, setStatus] = useState<{ text: string; tone: "info" | "success" | "error" | "warning" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [simMode, setSimMode] = useState<"empirical" | "live">("empirical");
  const [ownerBuyEth, setOwnerBuyEth] = useState(0.45);
  const [liquidityL, setLiquidityL] = useState(DEFAULT_LIQUIDITY_ESTIMATE);
  const [plan, setPlan] = useState<PlanStep[] | null>(null);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [empiricalStats, setEmpiricalStats] = useState<{
    floorMcUsd: number; afterOwnerBuyMcUsd: number; pctOfSupplyOwnerBought: number;
    ethReserveAfterOwnerBuy: number; tokenReserveAfterOwnerBuy: number;
  } | null>(null);

  const [signerProvider, setSignerProvider] = useState<BrowserProvider | null>(null);
  const [buyResults, setBuyResults] = useState<WalletEntry[]>([]);
  const [sellConfig, setSellConfig] = useState<Record<string, WalletSellConfig>>({});
  const watcherRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setStatusMsg = (text: string, tone: "info" | "success" | "error" | "warning" = "info") => setStatus({ text, tone });

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

  // ---- Section 3: fund + buy ----
  const handleFund = async () => {
    if (!plan || wallets.length === 0) return setStatusMsg("Run a simulation first.", "warning");
    if (!signerProvider) return setStatusMsg("Connect MetaMask first.", "warning");
    setStatusMsg("Funding wallets...", "info");
    const signer = await signerProvider.getSigner();
    const items = wallets.map((w, i) => ({ address: w.address, amountWei: parseEther((plan[i].ethGrossToSend * 1.03).toFixed(6)) }));
    const results = await distributeVariableEth(signer, items);
    const failed = results.filter((r) => r.status === "failed").length;
    setStatusMsg(failed > 0 ? `Funded with ${failed} failure(s).` : "All wallets funded.", failed > 0 ? "warning" : "success");
  };

  const handleBuy = async () => {
    if (!plan || wallets.length === 0) return setStatusMsg("Run a simulation first.", "warning");
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

        {/* 1. WALLETS */}
        <div className="mb-20"><StepCard step={1} title="Wallets" description="Generate a fresh wallet set, or load one you saved earlier from CSV">
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6 items-end">
            <Field label="Wallet count">
              <Input type="number" value={walletCount} onChange={(e) => setWalletCount(Number(e.target.value))} className="w-full" />
            </Field>
            <div className="flex gap-4 flex-wrap">
              <Button variant="primary" onClick={handleGenerate}><WalletIcon className="h-5 w-5" /> Generate</Button>
              <Button variant="secondary" onClick={handleSaveCsv}><Download className="h-5 w-5" /> Save (CSV)</Button>
              <Button variant="secondary" onClick={handleLoadClick}><Upload className="h-5 w-5" /> Load (CSV)</Button>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileSelected} className="hidden" />
            </div>
          </div>

          {mnemonic && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 flex items-start sm:items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-red-300 shrink-0" />
                <span className="text-base text-red-300 font-medium">Master seed phrase — back this up, never share it</span>
              </div>
              <SecretField value={mnemonic} />
            </div>
          )}

          {wallets.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-base">
                <thead>
                  <tr className="text-left text-sm uppercase tracking-wider text-zinc-500 bg-white/[0.04]">
                    <th className="py-4 px-5 font-medium">#</th>
                    <th className="py-4 px-5 font-medium">Address</th>
                    <th className="py-4 px-5 font-medium">Private Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {wallets.map((w) => (
                    <tr key={w.index} className="hover:bg-white/[0.03] transition">
                      <td className="py-4 px-5 text-zinc-500 font-mono">{w.index}</td>
                      <td className="py-4 px-5"><AddressChip address={w.address} /></td>
                      <td className="py-4 px-5"><SecretField value={w.privateKey} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-sm text-zinc-500 leading-relaxed">
            The exported CSV contains plain-text private keys and the master seed phrase. Treat it like cash: move it to
            a password manager or offline storage immediately, then delete the file.
          </p>
        </StepCard></div>

        {/* 2. SIMULATE */}
        <div className="mb-20"><StepCard
          step={2}
          title="Simulate"
          description="Model market cap and per-wallet buy sizes before spending anything"
          actions={
            <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1.5">
              <button
                onClick={() => setSimMode("empirical")}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition ${simMode === "empirical" ? "bg-brand text-black" : "text-zinc-400 hover:text-brand-goldLight"}`}
              >
                Empirical
              </button>
              <button
                onClick={() => setSimMode("live")}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition ${simMode === "live" ? "bg-brand text-black" : "text-zinc-400 hover:text-brand-goldLight"}`}
              >
                Live (on-chain)
              </button>
            </div>
          }
        >
          {simMode === "empirical" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
              <Field label="Owner's first buy (ETH)">
                <Input type="number" step="0.01" value={ownerBuyEth} onChange={(e) => setOwnerBuyEth(Number(e.target.value))} className="w-full" />
              </Field>
              <Field label="Liquidity estimate (L)">
                <Input type="number" value={liquidityL} onChange={(e) => setLiquidityL(Number(e.target.value))} className="w-full" />
              </Field>
              <Button variant="primary" onClick={handleSimulateEmpirical} className="h-14"><LineChart className="h-5 w-5" /> Simulate</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-end">
              <Field label="Token address">
                <Input placeholder="0x…" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} className="w-full font-mono" />
              </Field>
              <Button variant="primary" onClick={handleSimulateLive}><LineChart className="h-5 w-5" /> Simulate</Button>
            </div>
          )}

          {empiricalStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <StatBox label="Floor MC (pre-buy)" value={`$${empiricalStats.floorMcUsd.toFixed(0)}`} />
              <StatBox label="MC after owner buy" value={`$${empiricalStats.afterOwnerBuyMcUsd.toFixed(0)}`} tone="brand" />
              <StatBox label="Owner bought" value={`${empiricalStats.pctOfSupplyOwnerBought.toFixed(2)}%`} sub="of supply" />
              <StatBox
                label="Reserves (ETH / tok)"
                value={`${empiricalStats.ethReserveAfterOwnerBuy.toFixed(2)} / ${empiricalStats.tokenReserveAfterOwnerBuy.toFixed(0)}`}
              />
            </div>
          )}

          {plan && (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-base">
                <thead>
                  <tr className="text-left text-sm uppercase tracking-wider text-zinc-500 bg-white/[0.04]">
                    <th className="py-4 px-5 font-medium">Wallet</th>
                    <th className="py-4 px-5 font-medium">ETH to send</th>
                    <th className="py-4 px-5 font-medium">MC after buy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {plan.map((s) => (
                    <tr key={s.walletIndex} className="hover:bg-white/[0.03] transition">
                      <td className="py-4 px-5">
                        {wallets[s.walletIndex]?.address ? <AddressChip address={wallets[s.walletIndex].address} /> : <span className="text-zinc-400">#{s.walletIndex}</span>}
                      </td>
                      <td className="py-4 px-5 text-brand-goldLight font-mono">{s.ethGrossToSend.toFixed(5)} ETH</td>
                      <td className="py-4 px-5 text-zinc-400">${s.mcAfterUsd.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </StepCard></div>

        {/* 3. FUND & BUY */}
        <div className="mb-20"><StepCard step={3} title="Fund & Buy" description="Funding source: connected MetaMask wallet">
          <Field label="Token address (required to buy)">
            <Input placeholder="0x…" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} className="w-full font-mono" />
          </Field>
          <div className="flex gap-4 flex-wrap">
            <Button variant="secondary" onClick={handleFund}>Fund Wallets (+3% margin)</Button>
            <Button variant="primary" onClick={handleBuy}><Rocket className="h-5 w-5" /> Execute Buys</Button>
          </div>
        </StepCard></div>

        {/* 4. SELL PER WALLET */}
        <div className="mb-20"><StepCard step={4} title="Sell Per Wallet" description="Auto-sell polls every 5s once current MC ≥ entry MC × threshold">
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-base">
              <thead>
                <tr className="text-left text-sm uppercase tracking-wider text-zinc-500 bg-white/[0.04]">
                  <th className="py-4 px-5 font-medium">Wallet</th>
                  <th className="py-4 px-5 font-medium">Sell %</th>
                  <th className="py-4 px-5 font-medium">Sell at (x entry)</th>
                  <th className="py-4 px-5 font-medium">Auto</th>
                  <th className="py-4 px-5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {wallets.map((w) => {
                  const cfg = sellConfig[w.address] ?? { sellPct: 100, gainThreshold: 2, autoSell: false };
                  return (
                    <tr key={w.address} className="hover:bg-white/[0.03] transition">
                      <td className="py-4 px-5"><AddressChip address={w.address} /></td>
                      <td className="py-4 px-5">
                        <Input
                          compact type="number" value={cfg.sellPct}
                          onChange={(e) => setSellConfig((p) => ({ ...p, [w.address]: { ...cfg, sellPct: Number(e.target.value) } }))}
                          className="w-24"
                        />
                      </td>
                      <td className="py-4 px-5">
                        <Input
                          compact type="number" step="0.1" value={cfg.gainThreshold}
                          onChange={(e) => setSellConfig((p) => ({ ...p, [w.address]: { ...cfg, gainThreshold: Number(e.target.value) } }))}
                          className="w-24"
                        />
                      </td>
                      <td className="py-4 px-5">
                        <Toggle checked={cfg.autoSell} onChange={(v) => setSellConfig((p) => ({ ...p, [w.address]: { ...cfg, autoSell: v } }))} />
                      </td>
                      <td className="py-4 px-5">
                        <Button variant="secondary" onClick={() => handleSellWallet(w.address, w.privateKey)}>
                          <Target className="h-4 w-4" /> Sell Now
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </StepCard></div>
      </div>
    </div>
  );
}
