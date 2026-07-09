// lib/wallets/generator.ts
import { HDNodeWallet, Wallet } from "ethers";

export interface GeneratedWallet {
  index: number;
  address: string;
  privateKey: string;
}

export interface GeneratedWalletSet {
  mnemonic: string;
  wallets: GeneratedWallet[];
}

// New: returns the master seed phrase alongside the derived wallets,
// so the user can back it up once instead of only having per-wallet keys.
export function generateWalletSet(count: number, mnemonic?: string): GeneratedWalletSet {
  const root = mnemonic ? HDNodeWallet.fromPhrase(mnemonic) : Wallet.createRandom();
  const rootMnemonic = root.mnemonic?.phrase ?? mnemonic ?? "";

  const wallets: GeneratedWallet[] = [];
  for (let i = 0; i < count; i++) {
    const child = HDNodeWallet.fromPhrase(rootMnemonic, undefined, `m/44'/60'/0'/0/${i}`);
    wallets.push({ index: i, address: child.address, privateKey: child.privateKey });
  }

  return { mnemonic: rootMnemonic, wallets };
}

// Kept for the older /wallets page, which only expects the array.
export function generateWallets(count: number, mnemonic?: string): GeneratedWallet[] {
  return generateWalletSet(count, mnemonic).wallets;
}
