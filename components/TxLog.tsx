// components/TxLog.tsx
"use client";
import { LogEntry } from "@/lib/log/types";

const EXPLORER_BASE = "https://robinhoodchain.blockscout.com";

const levelStyles: Record<LogEntry["level"], string> = {
  info: "text-zinc-500",
  success: "text-green-600",
  warning: "text-amber-600",
  error: "text-red-600",
};

const levelIcon: Record<LogEntry["level"], string> = {
  info: "○",
  success: "●",
  warning: "▲",
  error: "✕",
};

export function TxLog({ entries, onClear }: { entries: LogEntry[]; onClear?: () => void }) {
  return (
    <div className="border rounded-lg">
      <div className="flex justify-between items-center px-4 py-2 border-b">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Activity Log</h2>
        {onClear && (
          <button onClick={onClear} className="text-xs text-zinc-400 hover:text-zinc-600">
            Clear
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto divide-y">
        {entries.length === 0 && (
          <p className="text-sm text-zinc-400 px-4 py-6 text-center">No activity yet.</p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="px-4 py-2 text-sm flex items-start gap-2">
            <span className={levelStyles[e.level]}>{levelIcon[e.level]}</span>
            <div className="flex-1">
              <span className={levelStyles[e.level]}>{e.message}</span>
              <div className="flex gap-3 text-xs text-zinc-400 mt-0.5">
                <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
                {e.walletAddress && <span className="font-mono">{e.walletAddress.slice(0, 8)}...</span>}
                {e.txHash && (
                  <a
                    href={`${EXPLORER_BASE}/tx/${e.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-zinc-600"
                  >
                    view tx ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
