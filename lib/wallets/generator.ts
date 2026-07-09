// lib/wallets/generator.ts
import { HDNodeWallet, Wallet } from "ethers";

export interface GeneratedWallet {
  index: number;
  address: string;
  privateKey: string;
}

export function generateWallets(count: number, mnemonic?: string): GeneratedWallet[] {
  const root = mnemonic
    ? HDNodeWallet.fromPhrase(mnemonic)
    : Wallet.createRandom();

  const rootMnemonic = root.mnemonic?.phrase;
  const wallets: GeneratedWallet[] = [];

  for (let i = 0; i < count; i++) {
    const child = rootMnemonic
      ? HDNodeWallet.fromPhrase(rootMnemonic, undefined, `m/44'/60'/0'/0/${i}`)
      : Wallet.createRandom();

    wallets.push({
      index: i,
      address: child.address,
      privateKey: child.privateKey,
    });
  }

  return wallets;
}

// Encrypted export, mirrors MetaMask's keystore format so users can
// import into any standard wallet later.
export async function exportEncrypted(wallets: GeneratedWallet[], password: string) {
  const keystores = await Promise.all(
    wallets.map((w) => new Wallet(w.privateKey).encrypt(password))
  );
  return keystores;
}
