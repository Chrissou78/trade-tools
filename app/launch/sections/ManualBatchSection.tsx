// app/launch/sections/ManualBatchSection.tsx
"use client";
import { useState } from "react";
import { Send, Rocket, Plus, Trash2, RefreshCw, PackageCheck } from "lucide-react";
import { StepCard, Field, Input, Button } from "@/components/ui";
import type { SendResult } from "@/lib/batch/sender";
import type { ManualBuyRow } from "../types";

// Any per-wallet outcome we render in a small list (send / prepare / swap).
type RowResult = { address: string; status: "success" | "failed"; txHash?: string; wrappedEth?: string; error?: string };

interface Props {
  // Shared token address (same value the Fund & Buy step uses).
  tokenAddress: string;
  onTokenAddressChange: (v: string) => void;
  // Panel A: load ETH to an address list at one fixed amount.
  fundList: string;
  onFundListChange: (v: string) => void;
  fundAmountEth: number;
  onFundAmountChange: (n: number) => void;
  onSendEthList: () => void;
  fundResults: SendResult[];
  // Panel B: prepare wallets ahead of launch, then fire swaps together.
  manualBuyRows: ManualBuyRow[];
  onAddBuyRow: (privateKey: string) => Promise<boolean>;
  onLoadKeys: (raw: string) => Promise<number>;
  onRemoveBuyRow: (index: number) => void;
  onRefreshBalances: () => void;
  onPrepareWallets: () => void;
  onFireBuys: () => void;
  concurrency: number;
  onConcurrencyChange: (n: number) => void;
  slippagePct: number;
  onSlippageChange: (n: number) => void;
  prepareResults: RowResult[];
  manualBuyResults: RowResult[];
}

function ResultList({ title, results = [] }: { title: string; results?: RowResult[] }) {
  if (results.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-5 py-3 text-sm uppercase tracking-wider text-zinc-500 bg-white/[0.04]">{title}</div>
      <div className="divide-y divide-white/5">
        {results.map((r, i) => (
          <div key={`${r.address}-${i}`} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
            <span className="font-mono text-zinc-400">{r.address.slice(0, 6)}…{r.address.slice(-4)}</span>
            {r.status === "success" ? (
              <span className="text-emerald-400">
                {r.wrappedEth ? `wrapped ${Number(r.wrappedEth).toFixed(5)} ETH` : "done"}
                {r.txHash ? ` · ${r.txHash.slice(0, 10)}…` : ""}
              </span>
            ) : (
              <span className="text-red-400 truncate max-w-[60%]" title={r.error}>failed{r.error ? `: ${r.error}` : ""}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ManualBatchSection({
  tokenAddress, onTokenAddressChange,
  fundList, onFundListChange, fundAmountEth, onFundAmountChange, onSendEthList, fundResults,
  manualBuyRows, onAddBuyRow, onLoadKeys, onRemoveBuyRow, onRefreshBalances, onPrepareWallets, onFireBuys,
  concurrency, onConcurrencyChange, slippagePct, onSlippageChange, prepareResults, manualBuyResults,
}: Props) {
  const [pkInput, setPkInput] = useState("");
  const [bulkKeys, setBulkKeys] = useState("");
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [rowError, setRowError] = useState("");
  const [adding, setAdding] = useState(false);

  const addressCount = fundList.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).length;
  const fundTotal = fundAmountEth > 0 && addressCount > 0 ? fundAmountEth * addressCount : 0;

  const handleAdd = async () => {
    setRowError("");
    const pk = pkInput.trim();
    if (!pk) { setRowError("Paste a private key."); return; }
    setAdding(true);
    const ok = await onAddBuyRow(pk);
    setAdding(false);
    if (ok) setPkInput("");
  };

  const handleLoadBulk = async () => {
    setRowError("");
    if (!bulkKeys.trim()) { setRowError("Paste one or more private keys."); return; }
    setLoadingKeys(true);
    const added = await onLoadKeys(bulkKeys);
    setLoadingKeys(false);
    if (added > 0) setBulkKeys("");
  };

  const bulkCount = bulkKeys.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).length;

  const readyToFire = manualBuyRows.filter((r) => Number(r.wethEth) > 0).length;
  const wethTotal = manualBuyRows.reduce((sum, r) => sum + (Number(r.wethEth) || 0), 0);

  return (
    <div className="mb-20"><StepCard
      step={4}
      title="Manual load & buy"
      description="Independent of the generated set. Load ETH to any address list, or buy from wallets you paste by private key."
    >
      {/* Panel A: load ETH to a list at a fixed amount */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Send className="h-5 w-5 text-brand-goldLight" />
          <h3 className="font-display text-lg font-semibold text-brand-goldLight">Load ETH to a wallet list</h3>
        </div>
        <Field label="Wallet addresses (one per line, or comma separated)">
          <textarea
            value={fundList}
            onChange={(e) => onFundListChange(e.target.value)}
            rows={5}
            placeholder={"0xabc...\n0xdef...\n0x123..."}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-base font-mono text-brand-goldLight placeholder:text-zinc-500 outline-none transition focus:border-brand focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(230,194,0,0.14)]"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-end">
          <Field label="Amount per wallet (ETH)">
            <Input
              type="number" step="0.001" min="0" value={fundAmountEth}
              onChange={(e) => onFundAmountChange(Number(e.target.value))}
              className="w-full"
            />
          </Field>
          <Button variant="primary" onClick={onSendEthList}><Send className="h-5 w-5" /> Send ETH</Button>
        </div>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Sends {fundAmountEth > 0 ? `${fundAmountEth} ETH` : "the amount above"} to each of {addressCount} address(es)
          {fundTotal > 0 ? `, ${fundTotal.toFixed(4)} ETH total` : ""}, from your connected MetaMask wallet.
        </p>
        <ResultList title="Send results" results={fundResults} />
      </div>

      {/* Panel B: prepare wallets, then fire swaps together */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Rocket className="h-5 w-5 text-brand-goldLight" />
          <h3 className="font-display text-lg font-semibold text-brand-goldLight">Buy max from wallets by private key</h3>
        </div>

        <p className="text-sm text-zinc-500 leading-relaxed">
          Two steps for a tight launch. <span className="text-brand-goldLight">Prepare</span> wraps the ETH in each wallet into WETH and
          approves the router ahead of time. At launch, <span className="text-brand-goldLight">Fire</span> sends one swap per wallet, all at once.
        </p>

        <Field label="Token to buy (shared with Fund & Buy)">
          <Input
            placeholder="0x…"
            value={tokenAddress}
            onChange={(e) => onTokenAddressChange(e.target.value)}
            className="w-full font-mono"
          />
        </Field>

        <Field label="Paste private keys (one per line, or comma separated)">
          <textarea
            value={bulkKeys}
            onChange={(e) => setBulkKeys(e.target.value)}
            rows={5}
            placeholder={"0xkey1...\n0xkey2...\n0xkey3..."}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-base font-mono text-brand-goldLight placeholder:text-zinc-500 outline-none transition focus:border-brand focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(230,194,0,0.14)]"
          />
        </Field>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-zinc-500">
            {bulkCount > 0 ? `${bulkCount} key(s) pasted. ` : ""}Invalid keys and duplicates are skipped. Cleared after loading.
          </p>
          <Button variant="secondary" onClick={handleLoadBulk} loading={loadingKeys}><Plus className="h-5 w-5" /> Load keys</Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-sm text-zinc-600">or add one</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
          <Field label="Private key">
            <Input
              type="password" value={pkInput} placeholder="0x…"
              onChange={(e) => setPkInput(e.target.value)}
              className="w-full font-mono"
            />
          </Field>
          <Button variant="secondary" onClick={handleAdd} loading={adding}><Plus className="h-5 w-5" /> Add wallet</Button>
        </div>
        {rowError && <p className="text-sm text-red-400">{rowError}</p>}

        {manualBuyRows.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-base">
              <thead>
                <tr className="text-left text-sm uppercase tracking-wider text-zinc-500 bg-white/[0.04]">
                  <th className="py-3 px-5 font-medium">#</th>
                  <th className="py-3 px-5 font-medium">Wallet</th>
                  <th className="py-3 px-5 font-medium">ETH</th>
                  <th className="py-3 px-5 font-medium">Max buy</th>
                  <th className="py-3 px-5 font-medium">WETH ready</th>
                  <th className="py-3 px-5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {manualBuyRows.map((row, i) => {
                  const ready = Number(row.wethEth) > 0;
                  return (
                    <tr key={row.address} className="hover:bg-white/[0.03] transition">
                      <td className="py-3 px-5 text-zinc-500 font-mono">{i + 1}</td>
                      <td className="py-3 px-5 font-mono text-brand-goldLight">{row.address.slice(0, 6)}…{row.address.slice(-4)}</td>
                      <td className="py-3 px-5 font-mono text-zinc-300">{Number(row.balanceEth).toFixed(5)}</td>
                      <td className="py-3 px-5 font-mono text-zinc-400">{Number(row.maxBuyEth).toFixed(5)}</td>
                      <td className={`py-3 px-5 font-mono ${ready ? "text-emerald-400" : "text-zinc-600"}`}>
                        {ready ? Number(row.wethEth).toFixed(5) : "—"}
                      </td>
                      <td className="py-3 px-5">
                        <Button variant="ghost" onClick={() => onRemoveBuyRow(i)}><Trash2 className="h-4 w-4" /> Remove</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-end gap-4 flex-wrap">
            <Field label="Wallets at a time">
              <Input
                type="number" min="1" max="29" value={concurrency}
                onChange={(e) => onConcurrencyChange(Math.max(1, Number(e.target.value)))}
                className="w-28"
              />
            </Field>
            <Field label="Max slippage %">
              <Input
                type="number" min="0" max="100" step="1" value={slippagePct}
                onChange={(e) => onSlippageChange(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-28"
              />
            </Field>
            <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
              Launches move fast — 50% is normal here. Lower wallets-at-a-time if sends drop; they retry automatically. {readyToFire}/{manualBuyRows.length} prepared
              {wethTotal > 0 ? ` · ${wethTotal.toFixed(4)} WETH ready` : ""}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="ghost" onClick={onRefreshBalances}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <Button variant="secondary" onClick={onPrepareWallets}><PackageCheck className="h-5 w-5" /> Prepare (wrap + approve)</Button>
            <Button variant="primary" onClick={onFireBuys}><Rocket className="h-5 w-5" /> Fire buys</Button>
          </div>
        </div>

        <ResultList title="Prepare results" results={prepareResults} />
        <ResultList title="Buy results" results={manualBuyResults} />
      </div>
    </StepCard></div>
  );
}
