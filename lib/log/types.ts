// lib/log/types.ts
export type LogLevel = "info" | "success" | "warning" | "error";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  txHash?: string;
  walletAddress?: string;
  tokenAddress?: string;
}
