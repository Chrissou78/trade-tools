// components/ui/index.tsx
"use client";
import { ReactNode, useState, InputHTMLAttributes, ButtonHTMLAttributes } from "react";
import { Loader2, Copy, Check, Eye, EyeOff } from "lucide-react";
import { copyToClipboard } from "@/lib/ui/clipboard";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="border-b border-white/10 bg-surface-1/90 backdrop-blur-xl">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-6 flex-wrap px-6 sm:px-12 py-10">
        <div className="space-y-2">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold gradient-text tracking-tight">{title}</h1>
          {subtitle && <p className="text-base text-brand-goldMuted/70">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}

export function StepCard({
  step, title, description, children, actions,
}: { step: number; title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="glass-card p-8 sm:p-12 space-y-8 mb-10">
      <div className="flex items-start justify-between gap-5 flex-wrap pb-2">
        <div className="flex items-center gap-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand/15 border border-brand/30 text-brand font-display font-semibold text-xl">
            {step}
          </span>
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-semibold text-brand-goldLight tracking-tight">{title}</h2>
            {description && <p className="text-base text-zinc-400">{description}</p>}
          </div>
        </div>
        {actions}
      </div>
      <div className="space-y-8">{children}</div>
    </section>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm uppercase tracking-wider text-zinc-500 mb-2.5 font-medium">{label}</label>
      {children}
    </div>
  );
}

export function Input({ className = "", compact, ...rest }: InputHTMLAttributes<HTMLInputElement> & { compact?: boolean }) {
  return (
    <input
      {...rest}
      className={
        (compact
          ? "rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base h-12 "
          : "rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-lg h-14 ") +
        "text-brand-goldLight placeholder:text-zinc-500 outline-none transition focus:border-brand focus:bg-white/[0.08] focus:shadow-[0_0_0_4px_rgba(230,194,0,0.14)] " +
        className
      }
    />
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  variant = "secondary", loading, className = "", children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
  const base = "inline-flex items-center justify-center gap-2.5 h-14 px-7 rounded-2xl text-base font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap";
  const variants: Record<BtnVariant, string> = {
    primary: "bg-brand text-black shadow-[0_12px_40px_-8px_rgba(230,194,0,0.55)] hover:brightness-110 hover:shadow-[0_16px_50px_-6px_rgba(230,194,0,0.7)]",
    secondary: "border border-white/15 bg-white/5 text-brand-goldLight hover:bg-white/10 hover:border-white/25",
    ghost: "text-zinc-400 hover:text-brand-goldLight hover:bg-white/5",
    danger: "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  };
  return (
    <button {...rest} disabled={disabled || loading} className={`${base} ${variants[variant]} ${className}`}>
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}

export function StatBox({
  label, value, sub, tone = "default",
}: { label: string; value: string; sub?: string; tone?: "default" | "brand" | "good" | "bad" }) {
  const toneColor = { default: "text-brand-goldLight", brand: "text-brand", good: "text-emerald-400", bad: "text-red-400" }[tone];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-2.5 hover:border-white/20 transition">
      <div className="text-sm uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`font-display text-3xl font-semibold ${toneColor}`}>{value}</div>
      {sub && <div className="text-sm text-zinc-500">{sub}</div>}
    </div>
  );
}

export function Banner({ tone, children }: { tone: "info" | "success" | "error" | "warning"; children: ReactNode }) {
  const styles = {
    info: "border-white/10 bg-white/5 text-brand-goldLight",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    error: "border-red-500/30 bg-red-500/10 text-red-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  };
  return <div className={`rounded-2xl border px-6 py-5 text-base leading-relaxed ${styles[tone]}`}>{children}</div>;
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-white/15"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-7 w-7 rounded-full bg-black shadow transition-transform ${checked ? "translate-x-6" : "translate-x-0"}`}
      />
    </button>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand to-brand-gold shadow-progress-glow transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function AddressChip({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { if (await copyToClipboard(address)) { setCopied(true); setTimeout(() => setCopied(false), 1200); } }}
      className="group inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-brand-goldLight hover:bg-white/10 hover:border-white/20 transition"
      title="Click to copy full address"
    >
      {address.slice(0, 6)}…{address.slice(-4)}
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-zinc-500 group-hover:text-brand-goldLight" />}
    </button>
  );
}

export function SecretField({ value, mono = true }: { value: string; mono?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm ${mono ? "font-mono" : ""} text-red-300/90 tracking-tight`}>
        {revealed ? value : "•".repeat(Math.min(value.length, 24))}
      </span>
      <button onClick={() => setRevealed((r) => !r)} className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-brand-goldLight transition" title={revealed ? "Hide" : "Reveal"}>
        {revealed ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
      </button>
      <button
        onClick={async () => { if (await copyToClipboard(value)) { setCopied(true); setTimeout(() => setCopied(false), 1200); } }}
        className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-brand-goldLight transition"
        title="Copy"
      >
        {copied ? <Check className="h-4.5 w-4.5 text-emerald-400" /> : <Copy className="h-4.5 w-4.5" />}
      </button>
    </div>
  );
}
