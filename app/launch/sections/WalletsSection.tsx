// app/launch/sections/WalletsSection.tsx
"use client";
import { RefObject } from "react";
import { Wallet as WalletIcon, ShieldAlert, Upload, Download } from "lucide-react";
import { GeneratedWallet } from "@/lib/wallets/generator";
import { StepCard, Field, Input, Button, AddressChip, SecretField } from "@/components/ui";

interface Props {
  walletCount: number;
  onWalletCountChange: (n: number) => void;
  mnemonic: string;
  wallets: GeneratedWallet[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onGenerate: () => void;
  onSaveCsv: () => void;
  onLoadClick: () => void;
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function WalletsSection({
  walletCount, onWalletCountChange, mnemonic, wallets,
  fileInputRef, onGenerate, onSaveCsv, onLoadClick, onFileSelected,
}: Props) {
  return (
    <div className="mb-20"><StepCard step={1} title="Wallets" description="Generate a fresh wallet set, or load one you saved earlier from CSV">
      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6 items-end">
        <Field label="Wallet count">
          <Input type="number" value={walletCount} onChange={(e) => onWalletCountChange(Number(e.target.value))} className="w-full" />
        </Field>
        <div className="flex gap-4 flex-wrap">
          <Button variant="primary" onClick={onGenerate}><WalletIcon className="h-5 w-5" /> Generate</Button>
          <Button variant="secondary" onClick={onSaveCsv}><Download className="h-5 w-5" /> Save (CSV)</Button>
          <Button variant="secondary" onClick={onLoadClick}><Upload className="h-5 w-5" /> Load (CSV)</Button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onFileSelected} className="hidden" />
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
  );
}
