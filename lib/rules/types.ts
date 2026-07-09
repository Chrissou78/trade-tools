// lib/rules/types.ts

export interface EntryConditions {
  enabled: boolean;
  maxMarketCapAfterFirstBuyUsd: number; // risk cap: skip if already pumped past this
  minLiquidity: number;                 // skip if L is suspiciously thin (possible trap)
  maxWalletBuyPctOfCap: number;         // e.g. 0.96 — how much of the max-wallet cap to target
  walletCount: number;                  // how many of your generated wallets to deploy per launch
  ethBudgetCapTotal: number;            // hard ceiling on total ETH committed per launch
}

export interface SellTrigger {
  id: string;
  type: "take_profit_mc_multiple" | "stop_loss_mc_drop_pct" | "graduation_reached" | "trailing_stop_pct";
  value: number;
  exitPercentage: number; // NEW — how much of current holdings to sell when this fires
}

export interface Position {
  tokenAddress: string;
  poolAddress: string;
  entryTxHashes: string[];
  entryMcUsd: number;
  entryTimestamp: number;
  walletAddresses: string[];
  tokensHeld: Record<string, bigint>; // per-wallet holdings
  status: "open" | "closed";
  sellTriggers: SellTrigger[];
  peakMcUsd: number; // for trailing-stop tracking
}
