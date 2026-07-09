'use client';

import { useState, useEffect } from 'react';
import { Wallet, Send, Zap, TrendingUp } from 'lucide-react';

export default function Dashboard({ activityStats }) {
  const [stats, setStats] = useState({
    walletsGenerated: 0,
    tokensLaunched: 0,
    totalTransactions: 0,
    totalVolume: 0,
  });

  // Listen for activity updates from localStorage
  useEffect(() => {
    const updateStats = () => {
      const stored = localStorage.getItem('solana-tools-stats');
      if (stored) {
        setStats(JSON.parse(stored));
      }
    };

    updateStats();
    window.addEventListener('storage', updateStats);
    // Check for updates every second
    const interval = setInterval(updateStats, 1000);

    return () => {
      window.removeEventListener('storage', updateStats);
      clearInterval(interval);
    };
  }, []);

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-4 border border-slate-600">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 border border-slate-700">
        <h1 className="text-3xl font-bold text-white mb-2">Solana Tools Suite</h1>
        <p className="text-slate-400">Generate wallets, launch tokens, and manage multi-wallet operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="Wallets Generated"
          value={stats.walletsGenerated}
          color="bg-blue-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Tokens Launched"
          value={stats.tokensLaunched}
          color="bg-green-600"
        />
        <StatCard
          icon={Send}
          label="Transactions"
          value={stats.totalTransactions}
          color="bg-purple-600"
        />
        <StatCard
          icon={Zap}
          label="Volume (SOL)"
          value={stats.totalVolume.toFixed(2)}
          color="bg-yellow-600"
        />
      </div>

      {/* Features Overview */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-4">Available Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="text-blue-400" size={24} />
              <h3 className="text-lg font-semibold text-white">Wallet Generator</h3>
            </div>
            <p className="text-slate-300 text-sm">Generate random, prefix, or suffix wallets from a single seed phrase</p>
          </div>
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="text-green-400" size={24} />
              <h3 className="text-lg font-semibold text-white">Token Launcher</h3>
            </div>
            <p className="text-slate-300 text-sm">Launch SPL tokens directly on Pump.fun with custom metadata</p>
          </div>
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-3 mb-2">
              <Send className="text-purple-400" size={24} />
              <h3 className="text-lg font-semibold text-white">Multi Sender</h3>
            </div>
            <p className="text-slate-300 text-sm">Send tokens to multiple addresses in bulk with custom amounts</p>
          </div>
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="text-yellow-400" size={24} />
              <h3 className="text-lg font-semibold text-white">Multi Swap</h3>
            </div>
            <p className="text-slate-300 text-sm">Execute swaps across multiple wallets simultaneously</p>
          </div>
        </div>
      </div>
    </div>
  );
}
