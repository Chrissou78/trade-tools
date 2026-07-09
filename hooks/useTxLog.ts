// hooks/useTxLog.ts
"use client";
import { useState, useCallback } from "react";
import { LogEntry, LogLevel } from "@/lib/log/types";

const MAX_ENTRIES = 200; // cap memory growth on a long-running session

export function useTxLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const log = useCallback(
    (level: LogLevel, message: string, extra?: Partial<Pick<LogEntry, "txHash" | "walletAddress" | "tokenAddress">>) => {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        level,
        message,
        ...extra,
      };
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
    },
    []
  );

  const clear = useCallback(() => setEntries([]), []);

  return { entries, log, clear };
}
