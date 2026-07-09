// lib/dex/tokenLimits.ts
import { JsonRpcProvider, Contract, Interface } from "ethers";

export interface TokenLimits {
  maxWalletTokens: bigint | null;
  maxTxTokens: bigint | null;
  decimals: number;
  matchedGetter: string | null;
}

const WALLET_GETTERS = [
  "function maxWalletTokens() view returns (uint256)",
  "function maxWalletAmount() view returns (uint256)",
  "function _maxWalletSize() view returns (uint256)",
  "function maxWallet() view returns (uint256)",
  "function maxWalletSize() view returns (uint256)",
];

const TX_GETTERS = [
  "function maxTxAmount() view returns (uint256)",
  "function _maxTxAmount() view returns (uint256)",
  "function maxTransactionAmount() view returns (uint256)",
];

async function probe(provider: JsonRpcProvider, token: string, sigs: string[]) {
  for (const sig of sigs) {
    try {
      const name = sig.split("function ")[1].split("(")[0];
      const contract = new Contract(token, new Interface([sig]), provider);
      const value: bigint = await contract[name]();
      if (value > 0n) return { value, matched: name };
    } catch {
      continue;
    }
  }
  return { value: null, matched: null };
}

export async function discoverTokenLimits(
  provider: JsonRpcProvider,
  tokenAddress: string
): Promise<TokenLimits> {
  const wallet = await probe(provider, tokenAddress, WALLET_GETTERS);
  const tx = await probe(provider, tokenAddress, TX_GETTERS);

  let decimals = 18;
  try {
    const erc20 = new Contract(tokenAddress, ["function decimals() view returns (uint8)"], provider);
    decimals = Number(await erc20.decimals());
  } catch {
    // fall back to 18 if the call fails
  }

  return {
    maxWalletTokens: wallet.value,
    maxTxTokens: tx.value,
    decimals,
    matchedGetter: wallet.matched,
  };
}
