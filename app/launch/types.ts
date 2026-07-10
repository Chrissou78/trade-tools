// app/launch/types.ts
// Shared shapes for the Launch Buyer flow. Kept in one place so the page
// container and each section component agree on the same structures.
import type { BuyResult } from "@/lib/batch/buyer";

export type StatusTone = "info" | "success" | "error" | "warning";

export interface StatusMsg {
  text: string;
  tone: StatusTone;
}

// One row of the buy plan: how much ETH a given wallet sends, and the
// modelled market cap right after that buy.
export interface PlanStep {
  walletIndex: number;
  ethGrossToSend: number;
  mcAfterUsd: number;
}

export interface WalletSellConfig {
  sellPct: number;
  gainThreshold: number;
  autoSell: boolean;
}

export interface WalletEntry extends BuyResult {
  entryMcUsd?: number;
}

export interface EmpiricalStats {
  floorMcUsd: number;
  afterOwnerBuyMcUsd: number;
  pctOfSupplyOwnerBought: number;
  ethReserveAfterOwnerBuy: number;
  tokenReserveAfterOwnerBuy: number;
}

export type SimMode = "empirical" | "live";

// One manually-added buy wallet. Wallets are wrapped ahead of launch, then the
// swap fires from the WETH balance. We store the address plus last-read native
// balance, wrapped (WETH) balance, and computed max for display.
export interface ManualBuyRow {
  privateKey: string;
  address: string;
  balanceEth: string;
  wethEth: string;
  maxBuyEth: string;
}
