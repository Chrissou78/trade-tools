// lib/wallets/csv.ts
import { GeneratedWallet } from "./generator";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvSplitLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { result.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

export function walletsToCsv(mnemonic: string, wallets: GeneratedWallet[]): string {
  const header = "index,address,privateKey,mnemonic";
  const rows = wallets.map((w) =>
    [String(w.index), w.address, w.privateKey, mnemonic].map(csvEscape).join(",")
  );
  return [header, ...rows].join("\n");
}

export function downloadWalletsCsv(mnemonic: string, wallets: GeneratedWallet[], filename = "wallets.csv") {
  const csv = walletsToCsv(mnemonic, wallets);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParsedWalletsCsv {
  mnemonic: string;
  wallets: GeneratedWallet[];
}

export function parseWalletsCsv(text: string): ParsedWalletsCsv {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV is empty or missing rows.");

  const header = csvSplitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idxIndex = header.indexOf("index");
  const idxAddress = header.indexOf("address");
  const idxKey = header.indexOf("privatekey");
  const idxMnemonic = header.indexOf("mnemonic");

  if (idxAddress === -1 || idxKey === -1) {
    throw new Error("CSV must contain 'address' and 'privateKey' columns.");
  }

  let mnemonic = "";
  const wallets: GeneratedWallet[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = csvSplitLine(lines[i]);
    const address = cols[idxAddress]?.trim();
    const privateKey = cols[idxKey]?.trim();
    if (!address || !privateKey) continue;
    const index = idxIndex !== -1 ? Number(cols[idxIndex]) : i - 1;
    if (idxMnemonic !== -1 && cols[idxMnemonic]) mnemonic = cols[idxMnemonic];
    wallets.push({ index, address, privateKey });
  }

  if (wallets.length === 0) throw new Error("No valid wallet rows found in CSV.");
  return { mnemonic, wallets };
}
