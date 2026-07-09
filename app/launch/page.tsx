// app/launch/page.tsx
"use client";
import { useState } from "react";
import { BrowserProvider, JsonRpcProvider, Wallet, parseEther, formatEther } from "ethers";
import { generateWallets, GeneratedWallet } from "@/lib/wallets/generator";
import { saveWalletsEncrypted, loadWalletsEncrypted } from "@/lib/wallets/storage";
import { findPoolAndState } from "@/lib/dex/pool";
import { planMultiWalletBuy } from "@/lib/dex/planMultiBuy";
import { distributeVariableEth } from "@/lib/batch/sender";
import { multiBuyVariable, BuyResult } from "@/lib/batch/buyer";
import { sellNoxaToken } from "@/lib/dex/sell";
import { useEthPrice } from "@/hooks/useEthPrice";
import { WalletConnectButton } from "@/components/WalletConnectButton";

const HTTP_RPC = process.env.NEXT_PUBLIC_ROBINHOOD_HTTP_RPC!;

interface PlanStep {
  walletIndex: number;
  targetTokens: number;
  ethGrossToSend: number;
}

export default function LaunchPage() {
  const ethPriceUsd = useEthPrice();
  const [tokenAddress, setTokenAddress] = useState("");
  const [walletCount, setWalletCount] = useState(5);
  const [password, setPassword] = useState("");
  const [wallets, setWallets] = useState<GeneratedWallet[]>([]);
  const [plan, setPlan] = useState<PlanStep[] | null>(null);
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [buyResults, setBuyResults] = useState<BuyResult[]>([]);
  const [status, setStatus] = useState("");
  const [sellPct, setSellPct] = useState<Record<string, number>>({});

  // Step 1: wallets
  const handleGenerate = () => {
    const gen = generateWallets(walletCount);
    setWallets(gen);
    setStatus(`Generated ${gen.length} wallets — save them before leaving this page.`);
  };
  const handleSave = async () => {
    if (!password) return setStatus("Set a password first.");
    await saveWalletsEncrypted(wallets, password);
    setStatus("Wallets saved (encrypted).");
  };
  const handleLoad = async () => {
    if (!password) return setStatus("Enter the password used to save.");
    const loaded = await loadWalletsEncrypted(password);
    if (!loaded) return setStatus("No saved wallets found.");
    setWallets(loaded);
    setStatus(`Loaded ${loaded.length} wallets.`);
  };

  // Step 2: simulate ETH needed per wallet for target % of max-wallet cap
  const handleSimulate = async () => {
    if (!tokenAddress) return setStatus("Enter a token address first.");
    if (!ethPriceUsd) return setStatus("Waiting on ETH price feed...");
    setStatus("Finding pool and simulating...");
    try {
      const provider = new JsonRpcProvider(HTTP_RPC);
      const poolState = await findPoolAndState(provider, tokenAddress);
      setPoolAddress(poolState.poolAddress);

      const result = await planMultiWalletBuy(
        provider,
        tokenAddress,
        poolState.poolAddress,
        wallets.length || walletCount,
        0.96, // target 96% of the max-wallet cap (~2% supply), leaves headroom for drift
        ethPriceUsd
      );
      setPlan(result);
      setStatus(`Simulation complete — total ETH needed: ${result.reduce((s, r) => s + r.ethGrossToSend, 0).toFixed(4)} ETH`);
    } catch (err: any) {
      setStatus(`Simulation failed: ${err.message}`);
    }
  };

  // Step 3: fund wallets from connected MetaMask wallet, with a 3% safety margin
  const handleFund = async () => {
    if (!plan || wallets.length === 0) return setStatus("Run simulation first.");
    if (!(window as any).ethereum) return setStatus("Connect MetaMask first.");
    setStatus("Funding wallets...");

    const browserProvider = new BrowserProvider((window as any).ethereum);
    const signer = await browserProvider.getSigner();

    const items = wallets.map((w, i) => ({
      address: w.address,
      amountWei: parseEther((plan[i].ethGrossToSend * 1.03).toFixed(6)), // +3% safety margin
    }));

    const results = await distributeVariableEth(signer, items, (r) =>
      setStatus(`Funded ${r.address.slice(0, 8)}... — ${r.status}`)
    );
    const failed = results.filter((r) => r.status === "failed").length;
    setStatus(failed > 0 ? `Funding done with ${failed} failure(s).` : "All wallets funded.");
  };

  // Step 4: execute the buys
  const handleBuy = async () => {
    if (!plan || wallets.length === 0) return setStatus("Run simulation first.");
    setStatus("Executing buys...");
    const provider = new JsonRpcProvider(HTTP_RPC);

    const items = wallets.map((w, i) => ({
      wallet: new Wallet(w.privateKey, provider),
      ethAmount: plan[i].ethGrossToSend.toFixed(6),
    }));

    const results = await multiBuyVariable(items, tokenAddress, 500, [300, 1500], (r) =>
      setStatus(`Buy ${r.address.slice(0, 8)}... — ${r.status}`)
    );
    setBuyResults(results);
    setStatus("Buys complete — see results below.");
  };

  // Step 5: sell a % from one specific wallet
  const handleSellWallet = async (privateKey: string, address: string) => {
    const pct = sellPct[address] ?? 100;
    setStatus(`Selling ${pct}% from ${address.slice(0, 8)}...`);
    try {
      const provider = new JsonRpcProvider(HTTP_RPC);
      const wallet = new Wallet(privateKey, provider);
      const outcome = await sellNoxaToken({ wallet, tokenAddress, sellPercentage: pct });
      setStatus(
        outcome.status === "success"
          ? `Sold ${pct}% from ${address.slice(0, 8)}... — tx ${outcome.swapTxHash.slice(0, 10)}...`
          : `Sale succeeded but WETH unwrap failed for ${address.slice(0, 8)}... (${outcome.unwrapError})`
      );
    } catch (err: any) {
      setStatus(`Sell failed for ${address.slice(0, 8)}...: ${err.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Launch Buyer</h1>
        <WalletConnectButton />
      </div>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">1. Token & Wallets</h2>
        <input
          placeholder="Token address"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          className="border rounded px-3 py-2 w-full font-mono text-sm"
        />
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-sm text-zinc-500">Wallet count</label>
            <input type="number" value={walletCount} onChange={(e) => setWalletCount(Number(e.target.value))} className="border rounded px-3 py-2 w-24" />
          </div>
          <div>
            <label className="block text-sm text-zinc-500">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="border rounded px-3 py-2" />
          </div>
          <button onClick={handleGenerate} className="px-4 py-2 bg-black text-white rounded">Generate</button>
          <button onClick={handleSave} className="px-4 py-2 border rounded">Save</button>
          <button onClick={handleLoad} className="px-4 py-2 border rounded">Load</button>
        </div>
        <p className="text-sm text-zinc-500">{wallets.length} wallet(s) ready.</p>
      </section>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">2. Simulate ETH Needed (2% supply target)</h2>
        <button onClick={handleSimulate} className="px-4 py-2 bg-black text-white rounded">Simulate</button>
        {plan && (
          <table className="w-full text-sm mt-3">
            <thead><tr className="text-left text-zinc-400"><th>Wallet</th><th>ETH to send</th></tr></thead>
            <tbody>
              {plan.map((s) => (
                <tr key={s.walletIndex} className="border-t">
                  <td>{wallets[s.walletIndex]?.address.slice(0, 10)}...</td>
                  <td>{s.ethGrossToSend.toFixed(5)} ETH</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">3. Fund & Buy</h2>
        <div className="flex gap-3">
          <button onClick={handleFund} className="px-4 py-2 border rounded">Fund Wallets (+3% margin)</button>
          <button onClick={handleBuy} className="px-4 py-2 bg-black text-white rounded">Execute Buys</button>
        </div>
      </section>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">4. Sell Per Wallet</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-zinc-400"><th>Wallet</th><th>Sell %</th><th></th></tr></thead>
          <tbody>
            {wallets.map((w) => (
              <tr key={w.address} className="border-t">
                <td className="font-mono">{w.address.slice(0, 10)}...</td>
                <td>
                  <input
                    type="number"
                    value={sellPct[w.address] ?? 100}
                    onChange={(e) => setSellPct((prev) => ({ ...prev, [w.address]: Number(e.target.value) }))}
                    className="border rounded px-2 py-1 w-20"
                  />
                </td>
                <td>
                  <button onClick={() => handleSellWallet(w.privateKey, w.address)} className="px-3 py-1 border rounded">Sell</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {status && <p className="text-sm text-zinc-500 border-t pt-4">{status}</p>}
    </div>
  );
}
