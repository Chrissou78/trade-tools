// components/Toast.tsx
"use client";
import { useEffect } from "react";

export interface ToastItem {
  id: string;
  text: string;
  tone: "info" | "success" | "error" | "warning";
}

const toneStyles: Record<ToastItem["tone"], string> = {
  info: "border-zinc-600 bg-zinc-800 text-zinc-100",
  success: "border-green-600 bg-green-900/90 text-green-200",
  error: "border-red-600 bg-red-900/90 text-red-200",
  warning: "border-amber-600 bg-amber-900/90 text-amber-200",
};

const toneIcon: Record<ToastItem["tone"], string> = {
  info: "ℹ",
  success: "✓",
  error: "✕",
  warning: "⚠",
};

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      onClick={() => onDismiss(toast.id)}
      className={`border rounded-lg px-4 py-3 text-sm shadow-lg cursor-pointer flex items-start gap-2 animate-in ${toneStyles[toast.tone]}`}
    >
      <span className="text-base leading-none">{toneIcon[toast.tone]}</span>
      <span className="flex-1">{toast.text}</span>
    </div>
  );
}
