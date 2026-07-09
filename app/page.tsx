// app/page.tsx
import Link from "next/link";

const tools = [
  { href: "/wallets", label: "Multi Wallet Generator", desc: "Generate and manage EVM sub-wallets" },
  { href: "/sender", label: "Multi Sender", desc: "Fund or sweep ETH/tokens across wallets" },
  { href: "/buyer", label: "Multi Buyer", desc: "Sequential buy simulation + execution" },
  { href: "/swap", label: "Swap", desc: "Manual swap with live chart" },
];

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-6">
      <h1 className="text-2xl font-semibold mb-2">Trade Tools — Robinhood Chain</h1>
      <p className="text-zinc-500 mb-8">Manual launch tools and automated scanner, side by side.</p>

      <h2 className="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wide">Launch Tools</h2>
      <div className="grid grid-cols-2 gap-4 mb-10">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className="border rounded-lg p-4 hover:border-black dark:hover:border-white transition">
            <div className="font-medium">{t.label}</div>
            <div className="text-sm text-zinc-500">{t.desc}</div>
          </Link>
        ))}
      </div>

      <h2 className="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wide">Automation</h2>
      <Link href="/scanner" className="border rounded-lg p-4 block hover:border-black dark:hover:border-white transition">
        <div className="font-medium">Scanner + Auto-Trade Rules</div>
        <div className="text-sm text-zinc-500">Detect new NOXA launches, apply entry/exit rules on demand</div>
      </Link>
    </div>
  );
}
