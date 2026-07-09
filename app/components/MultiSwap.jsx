'use client';

import { useState } from 'react';
import { Zap, Plus, Trash2, ArrowRight, X } from 'lucide-react';

export default function MultiSwap() {
  const [swaps, setSwaps] = useState([]);
  const [fromToken, setFromToken] = useState('SOL');
  const [toToken, setToToken] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [priorityFee, setPriorityFee] = useState(0.001);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState([]);

  const addSwap = () => {
    setSwaps([
      ...swaps,
      {
        id: Math.random().toString(36).substr(2, 9),
        wallet: '',
        amount: '',
        status: 'pending',
      },
    ]);
  };

  const updateSwap = (id, field, value) => {
    setSwaps(swaps.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const removeSwap = (id) => {
    setSwaps(swaps.filter((s) => s.id !== id));
  };

  const clearAllSwaps = () => {
    if (confirm('Clear all swaps?')) {
      setSwaps([]);
    }
  };

  const handleExecuteSwaps = async () => {
    if (!toToken || swaps.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    setIsExecuting(true);
    const newResults = [];

    try {
      for (const swap of swaps) {
        const result = {
          wallet: swap.wallet,
          fromAmount: swap.amount,
          toAmount: (parseFloat(swap.amount) * 0.95).toFixed(2),
          txHash: `${Math.random().toString(36).substr(2, 9)}...`,
          status: 'success',
          timestamp: new Date().toLocaleTimeString(),
        };
        newResults.push(result);
        setResults([...newResults]);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const stored = localStorage.getItem('solana-tools-stats');
      const stats = stored
        ? JSON.parse(stored)
        : { walletsGenerated: 0, tokensLaunched: 0, totalTransactions: 0, totalVolume: 0 };
      stats.totalTransactions += swaps.length;
      stats.totalVolume += swaps.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      localStorage.setItem('solana-tools-stats', JSON.stringify(stats));
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Swap error:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const totalAmount = swaps.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Configuration */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-4">Multi Swap</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* From Token */}
          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2">From Token</label>
            <input
              type="text"
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value)}
              placeholder="SOL"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* To Token */}
          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2">To Token</label>
            <input
              type="text"
              value={toToken}
              onChange={(e) => setToToken(e.target.value)}
              placeholder="Token mint"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* Slippage */}
          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2">Slippage (%)</label>
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value))}
              step="0.1"
              min="0"
              max="50"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* Priority Fee */}
          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2">Priority Fee (SOL)</label>
            <input
              type="number"
              value={priorityFee}
              onChange={(e) => setPriorityFee(parseFloat(e.target.value))}
              step="0.0001"
              min="0"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Swap Wallets - Full Height */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 border border-slate-700 flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white">Swap Wallets</h3>
            <p className="text-slate-400 text-sm">Total: {swaps.length} | Amount: {totalAmount.toFixed(4)} {fromToken}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addSwap}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              Add Wallet
            </button>
            {swaps.length > 0 && (
              <button
                onClick={clearAllSwaps}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-all flex items-center gap-2 text-sm"
              >
                <X size={16} />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Swaps Table - Full Scrollable Area */}
        <div className="flex-1 overflow-y-auto border border-slate-600 rounded-lg bg-slate-700 mb-4 min-h-0">
          <div className="grid grid-cols-12 gap-2 p-3 sticky top-0 bg-slate-800 border-b border-slate-600 font-semibold text-slate-300 text-sm">
            <div className="col-span-1">#</div>
            <div className="col-span-8">Wallet / Private Key</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-1">Action</div>
          </div>

          <div className="divide-y divide-slate-600">
            {swaps.length > 0 ? (
              swaps.map((swap, index) => (
                <div key={swap.id} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-600 transition-all">
                  <div className="col-span-1 text-slate-300 font-mono text-sm">{index + 1}</div>
                  <div className="col-span-8">
                    <input
                      type="text"
                      value={swap.wallet}
                      onChange={(e) => updateSwap(swap.id, 'wallet', e.target.value)}
                      placeholder="Paste wallet private key"
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={swap.amount}
                      onChange={(e) => updateSwap(swap.id, 'amount', e.target.value)}
                      placeholder="0.0000"
                      step="0.0001"
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => removeSwap(swap.id)}
                      className="p-1 hover:bg-red-600 rounded transition-all text-slate-400 hover:text-white w-full"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-400">
                <p>No wallets added yet. Click "Add Wallet" to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Execute Button */}
        <button
          onClick={handleExecuteSwaps}
          disabled={isExecuting || !toToken || swaps.length === 0}
          className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <Zap size={18} />
          {isExecuting ? 'Executing Swaps...' : `Execute ${swaps.length} Swaps`}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 border border-slate-700 flex flex-col max-h-96">
          <h3 className="text-xl font-bold text-white mb-4 flex-shrink-0">Swap Results ({results.length})</h3>
          <div className="space-y-2 overflow-y-auto flex-1">
            {results.map((result, index) => (
              <div
                key={index}
                className="bg-slate-700 rounded p-3 flex items-center justify-between border border-slate-600"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-mono text-sm truncate">{result.wallet.slice(0, 30)}...</p>
                  <div className="flex items-center gap-2 text-slate-400 text-xs mt-1">
                    <span>{result.fromAmount} {fromToken}</span>
                    <ArrowRight size={12} />
                    <span>{result.toAmount} {toToken.slice(0, 10)}...</span>
                  </div>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <p className="text-green-400 text-sm font-semibold">✓ {result.status}</p>
                  <p className="text-slate-400 text-xs">{result.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
