'use client'

import { Zap } from 'lucide-react'

export default function Navigation() {
  return (
    <header className="h-20 border-b border-purple-500/20 backdrop-blur-xl bg-slate-900/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold shadow-lg shadow-purple-500/50">
            🦥
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Solana Tools</h1>
            <p className="text-xs text-purple-300 font-semibold">Professional Dev Suite</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <Zap size={16} className="text-purple-400" />
            <span className="text-sm text-purple-300 font-semibold">Mainnet</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center hover:border-purple-500 transition cursor-pointer">
            <span className="text-lg">⚙️</span>
          </div>
        </div>
      </div>
    </header>
  )
}
