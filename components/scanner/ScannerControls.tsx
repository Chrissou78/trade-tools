// components/scanner/ScannerControls.tsx
"use client";
export function ScannerControls({
  isScanning, onStart, onStop, autoExecute, onToggleAutoExecute,
}: { isScanning: boolean; onStart: () => void; onStop: () => void; autoExecute: boolean; onToggleAutoExecute: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-4 mb-6 p-4 border rounded-lg">
      <button
        onClick={isScanning ? onStop : onStart}
        className={`px-4 py-2 rounded font-medium ${isScanning ? "bg-red-600 text-white" : "bg-black text-white"}`}
      >
        {isScanning ? "Stop Scanning" : "Start Scanning"}
      </button>
      <span className={`text-sm ${isScanning ? "text-green-600" : "text-zinc-400"}`}>
        {isScanning ? "● Live — watching Launch Factory" : "○ Idle"}
      </span>
      <label className="flex items-center gap-2 text-sm ml-auto">
        <input type="checkbox" checked={autoExecute} onChange={(e) => onToggleAutoExecute(e.target.checked)} />
        Auto-execute buys (off = dry-run only)
      </label>
    </div>
  );
}
