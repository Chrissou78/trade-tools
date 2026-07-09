// app/launch/page.tsx
"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { BrowserProvider, JsonRpcProvider, Wallet, parseEther } from "ethers";
import { generateWalletSet, GeneratedWallet } from "@/lib/wallets/generator";
import { saveWalletsEncrypted, loadWalletsEncrypted } from "@/lib/wallets/storage";
import { copyToClipboard } from "@/lib/ui/clipboard";
import { findPoolAndState } from "@/lib/dex/pool";
import { planMultiWalletBuy } from "@/lib/dex/planMultiBuy";
import { simulateFromOwnerBuy, DEFAULT_LIQUIDITY_ESTIMATE } from "@/lib/dex/empiricalSim";
import { distributeVariableEth } from "@/lib/batch/sender";
import { multiBuyVariable, BuyResult } from "@/lib/batch/buyer";
import { sellNoxaToken } from "@/lib/dex/sell";
import { getLiveSqrtPrice, sqrtPToMarketCapUsd } from "@/lib/dex/noxaCurve";
import { useEthPrice } from "@/hooks/useEthPrice";
import { WalletConnectButton } from "@/components/WalletConnectButton";

const HTTP_RPC = process.env.NEXT_PUBLIC_ROBINHOOD_HTTP_RPC!;

interface PlanStep { walletIndex: number; ethGrossToSend: number; mcAfterUsd: number }
interface WalletSellConfig { sellPct: number; gainThreshold: number; autoSell: boolean }
interface WalletEntry extends BuyResult { entryMcUsd?: number }

function AddressChip({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { if (await copyToClipboard(address)) { setCopied(true); setTimeout(() => setCopied(false), 1200); } }}
      className="font-mono text-xs bg-zinc-100 hover:bg-zinc-200 rounded px-2 py-1 transition"
      title="Click to copy full address"
    >
      {copied ? "Copied!" : `${address.slice(0, 8)}...${address.slice(-6)}`}
    </button>
  );
}

function PrivateKeyCell({ privateKey }: { privateKey: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-red-600">
        {revealed ? privateKey : "••••••••••••••••••••"}
      </span>
      <button onClick={() => setRevealed((r) => !r)} className="text-xs text-zinc-500 underline">
        {revealed ? "Hide" : "Reveal"}
      </button>
      <button
        onClick={async () => { if (await copyToClipboard(privateKey)) { setCopied(true); setTimeout(() => setCopied(false), 1200); } }}
        className="text-xs text-zinc-500 underline"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export default function LaunchPage() {
  const ethPriceUsd = useEthPrice();
  const [tokenAddress, setTokenAddress] = useState("");
  const [walletCount, setWalletCount] = useState(5);
  const [password, setPassword] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [mnemonicRevealed, setMnemonicRevealed] = useState(false);
  const [wallets, setWallets] = useState<GeneratedWallet[]>([]);
  const [status, setStatus] = useState<{ text: string; tone: "info" | "success" | "error" | "warning" } | null>(null);

  const [simMode, setSimMode] = useState<"empirical" | "live">("empirical");
  const [ownerBuyEth, setOwnerBuyEth] = useState(0.45);
  const [liquidityL, setLiquidityL] = useState(DEFAULT_LIQUIDITY_ESTIMATE);
  const [plan, setPlan] = useState<PlanStep[] | null>(null);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);

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
    setStatusMsg(`Generated ${w.length} wallets. Back up the seed phrase before leaving this page.`, "warning");
  };
  const handleSave = async () => {
    if (!password) return setStatusMsg("Set a password first.", "warning");
    await saveWalletsEncrypted({ mnemonic, wallets }, password);
    setStatusMsg("Wallets and seed phrase saved (encrypted).", "success");
  };
  const handleLoad = async () => {
    if (!password) return setStatusMsg("Enter the password used to save.", "warning");
    const loaded = await loadWalletsEncrypted(password);
    if (!loaded) return setStatusMsg("No saved wallets found.", "error");
    setMnemonic(loaded.mnemonic ?? "");
    setWallets(loaded.wallets ?? loaded); // supports old format too
    setStatusMsg(`Loaded ${(loaded.wallets ?? loaded).length} wallets.`, "success");
  };

  // ---- Section 2: simulate ----
  const handleSimulateEmpirical = () => {
    if (!ethPriceUsd) return setStatusMsg("Waiting on ETH price feed...", "warning");
    const { steps } = simulateFromOwnerBuy({
      ownerBuyEth,
      walletCount: wallets.length || walletCount,
      targetPctOfSupplyPerWallet: 0.02,
      liquidityL,
      ethPriceUsd,
    });
    setPlan(steps.map((s) => ({ walletIndex: s.walletIndex, ethGrossToSend: s.ethGrossToSend, mcAfterUsd: s.mcAfterUsd })));
    setStatusMsg(`Empirical estimate ready — total ${steps.reduce((s, x) => s + x.ethGrossToSend, 0).toFixed(4)} ETH. Liquidity is an assumption until calibrated live.`, "info");
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
    setStatusMsg("Executing buys...", "info");
    const provider = new JsonRpcProvider(HTTP_RPC);
    const items = wallets.map((w, i) => ({ wallet: new Wallet(w.privateKey, provider), ethAmount: plan[i].ethGrossToSend.toFixed(6) }));
    const results = await multiBuyVariable(items, tokenAddress, 500, [300, 1500]);

    // Capture entry MC per wallet right after each buy lands, for gain-threshold tracking.
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

  // ---- Section 4: sell per wallet, manual or auto by gain threshold ----
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

  // Polling watcher: checks every 5s whether any auto-sell-enabled wallet
  // has crossed its gain threshold relative to its own entry MC.
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

  const statusColor = { info: "border-zinc-300 bg-zinc-50 text-zinc-700", success: "border-green-300 bg-green-50 text-green-700", error: "border-red-300 bg-red-50 text-red-700", warning: "border-amber-300 bg-amber-50 text-amber-700" };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Launch Buyer</h1>
        <WalletConnectButton onConnected={(_, provider) => setSignerProvider(provider)} />
      </div>

      {status && (
        <div className={`border rounded-lg px-4 py-3 text-sm ${statusColor[status.tone]}`}>{status.text}</div>
      )}

      <section className="border border-zinc-200 rounded-xl p-5 space-y-4 shadow-sm">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500">1. Wallets</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Wallet count</label>
            <input type="number" value={walletCount} onChange={(e) => setWalletCount(Number(e.target.value))} className="border rounded-lg px-3 py-2 w-24 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Encryption password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button onClick={handleGenerate} className="px-4 py-2 bg-black text-white rounded-lg text-sm">Generate</button>
          <button onClick={handleSave} className="px-4 py-2 border rounded-lg text-sm">Save</button>
          <button onClick={handleLoad} className="px-4 py-2 border rounded-lg text-sm">Load</button>
        </div>

        {mnemonic && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-xs text-red-700 font-medium">Master seed phrase (back this up, never share it)</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-red-600">{mnemonicRevealed ? mnemonic : "•••• •••• •••• •••• •••• ••••"}</span>
              <button onClick={() => setMnemonicRevealed((r) => !r)} className="text-xs underline">{mnemonicRevealed ? "Hide" : "Reveal"}</button>
              <button onClick={async () => { await copyToClipboard(mnemonic); }} className="text-xs underline">Copy</button>
            </div>
          </div>
        )}

        {wallets.length > 0 && (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-zinc-400 border-b"><th className="py-2">#</th><th>Address</th><th>Private Key</th></tr></thead>
            <tbody>
              {wallets.map((w) => (
                <tr key={w.index} className="border-b">
                  <td className="py-2 text-zinc-500">{w.index}</td>
                  <td><AddressChip address={w.address} /></td>
                  <td><PrivateKeyCell privateKey={w.privateKey} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="border border-zinc-200 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500">2. Simulate</h2>
          <div className="flex gap-2 text-xs">
            <button onClick={() => setSimMode("empirical")} className={`px-3 py-1 rounded-full border ${simMode === "empirical" ? "bg-black text-white" : ""}`}>Empirical (no address)</button>
            <button onClick={() => setSimMode("live")} className={`px-3 py-1 rounded-full border ${simMode === "live" ? "bg-black text-white" : ""}`}>Live (on-chain)</button>
          </div>
        </div>

        {simMode === "empirical" ? (
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Owner's first buy (ETH)</label>
              <input type="number" step="0.01" value={ownerBuyEth} onChange={(e) => setOwnerBuyEth(Number(e.target.value))} className="border rounded-lg px-3 py-2 w-32 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Liquidity estimate (L)</label>
              <input type="number" value={liquidityL} onChange={(e) => setLiquidityL(Number(e.target.value))} className="border rounded-lg px-3 py-2 w-36 text-sm" />
            </div>
            <button onClick={handleSimulateEmpirical} className="px-4 py-2 bg-black text-white rounded-lg text-sm">Simulate</button>
          </div>
        ) : (
          <div className="flex gap-3 items-end flex-wrap">
            <input placeholder="Token address" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} className="border rounded-lg px-3 py-2 flex-1 font-mono text-sm" />
            <button onClick={handleSimulateLive} className="px-4 py-2 bg-black text-white rounded-lg text-sm">Simulate</button>
          </div>
        )}

        {plan && (
          <table className="w-full text-sm mt-2">
            <thead><tr className="text-left text-zinc-400"><th>Wallet</th><th>ETH to send</th><th>MC after buy</th></tr></thead>
            <tbody>
              {plan.map((s) => (
                <tr key={s.walletIndex} className="border-t">
                  <td>{wallets[s.walletIndex]?.address ? <AddressChip address={wallets[s.walletIndex].address} /> : `#${s.walletIndex}`}</td>
                  <td>{s.ethGrossToSend.toFixed(5)} ETH</td>
                  <td className="text-zinc-500">${s.mcAfterUsd.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="border border-zinc-200 rounded-xl p-5 space-y-3 shadow-sm">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500">3. Fund & Buy</h2>
        <p className="text-xs text-zinc-500">Funding source: connected MetaMask wallet. Requires a token address (switch to Live simulation, or paste it directly) to execute buys.</p>
        <input placeholder="Token address (required to buy)" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} className="border rounded-lg px-3 py-2 w-full font-mono text-sm" />
        <div className="flex gap-3">
          <button onClick={handleFund} className="px-4 py-2 border rounded-lg text-sm">Fund Wallets (+3% margin)</button>
          <button onClick={handleBuy} className="px-4 py-2 bg-black text-white rounded-lg text-sm">Execute Buys</button>
        </div>
      </section>

      <section className="border border-zinc-200 rounded-xl p-5 space-y-3 shadow-sm">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500">4. Sell Per Wallet</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-zinc-400"><th>Wallet</th><th>Sell %</th><th>Sell at (x entry)</th><th>Auto</th><th></th></tr></thead>
          <tbody>
            {wallets.map((w) => {
              const cfg = sellConfig[w.address] ?? { sellPct: 100, gainThreshold: 2, autoSell: false };
              return (
                <tr key={w.address} className="border-t">
                  <td><AddressChip address={w.address} /></td>
                  <td>
                    <input type="number" value={cfg.sellPct} onChange={(e) => setSellConfig((p) => ({ ...p, [w.address]: { ...cfg, sellPct: Number(e.target.value) } }))} className="border rounded px-2 py-1 w-16 text-sm" />
                  </td>
                  <td>
                    <input type="number" step="0.1" value={cfg.gainThreshold} onChange={(e) => setSellConfig((p) => ({ ...p, [w.address]: { ...cfg, gainThreshold: Number(e.target.value) } }))} className="border rounded px-2 py-1 w-16 text-sm" />
                  </td>
                  <td>
                    <input type="checkbox" checked={cfg.autoSell} onChange={(e) => setSellConfig((p) => ({ ...p, [w.address]: { ...cfg, autoSell: e.target.checked } }))} />
                  </td>
                  <td>
                    <button onClick={() => handleSellWallet(w.address, w.privateKey)} className="px-3 py-1 border rounded-lg text-sm">Sell Now</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-zinc-500">Auto-sell polls every 5s and fires once current market cap ≥ entry MC × threshold. Requires a completed buy first (entry MC is captured then).</p>
      </section>
    </div>
  );
}
