'use client';

import { Wallet, TrendingUp, Send, Zap, BarChart3, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const [isOpen, setIsOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'wallet', label: 'Wallet Generator', icon: Wallet },
    { id: 'token', label: 'Token Launcher', icon: TrendingUp },
    { id: 'multisender', label: 'Multi Sender', icon: Send },
    { id: 'multiswap', label: 'Multi Swap', icon: Zap },
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-700 text-white p-2 rounded-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`${
          isOpen ? 'w-64' : 'w-0'
        } bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 transition-all duration-300 overflow-hidden flex flex-col`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-white">Solana Tools</h1>
          <p className="text-slate-400 text-xs mt-1">Professional Suite</p>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Icon size={20} />
                <span className="font-semibold">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-700 text-xs text-slate-400">
          <p>v1.0.0</p>
          <p className="mt-2">Ready for mainnet deployment</p>
        </div>
      </div>
    </>
  );
}
