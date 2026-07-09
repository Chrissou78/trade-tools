// hooks/useToasts.ts
"use client";
import { useState, useCallback } from "react";
import { ToastItem } from "@/components/Toast";

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((text: string, tone: ToastItem["tone"] = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, tone }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, notify, dismiss };
}
