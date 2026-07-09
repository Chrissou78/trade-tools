'use client';

import { useState } from 'react';
import { Download, Upload, Send, Trash2, Plus, Copy, Check, X } from 'lucide-react';
import Papa from 'papaparse';

export default function MultiSender() {
  const [recipients, setRecipients] = useState([]);
  const [tokenMint, setTokenMint] = useState('');
  const [senderPrivateKey, setSenderPrivateKey] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [results, setResults] = useState([]);
  const [copied, setCopied] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  const parseBulkInput = () => {
    const lines = bulkInput.trim().split('\n');
    const parsed = [];

    lines.forEach((line) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts[0] && parts[1]) {
        parsed.push({
          id: Math.random().toString(36).substr(2, 9),
          address: parts[0],
          amount: parts[1],
          status: 'pending',
        });
      }
    });

    setRecipients([...recipients, ...parsed]);
    setBulkInput('');
    setShowBulkModal(false);
  };

  const addRecipient = () => {
    setRecipients([
      ...recipients,
      {
        id: Math.random().toString(36).substr(2, 9),
        address: '',
        amount: '',
        status: 'pending',
      },
    ]);
  };

  const updateRecipient = (id, field, value) => {
    setRecipients(
      recipients.map((r) =>
        r.id === id ? { ...r, [field]: value } : r
      )
    );
  };

  const removeRecipient = (id) => {
    setRecipients(recipients.filter((r) => r.id !== id));
  };

  const clearAllRecipients = () => {
    if (confirm('Are you sure you want to clear all recipients?')) {
      setRecipients([]);
    }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const parsed = results.data
          .filter((row) => row.address && row.amount)
          .map((row) => ({
            id: Math.random().toString(36).substr(2, 9),
            address: row.address,
            amount: row.amount,
            status: 'pending',
          }));
        setRecipients([...recipients, ...parsed]);
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
      },
    });
  };

  const downloadTemplate = () => {
    const template = 'address,amount\n9B5X4...,100\n7kZ2M...,50\n';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'recipients_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadRecipients = () => {
    const csv = [
      'address,amount',
      ...recipients.map((r) => `${r.address},${r.amount}`),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recipients_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendTokens = async () => {
    if (!tokenMint || !senderPrivateKey || recipients.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSending(true);
    const newResults = [];

    try {
      for (const recipient of recipients) {
        // Simulate transaction (replace with actual RPC call)
        const result = {
          address: recipient.address,
          amount: recipient.amount,
          txHash: `${Math.random().toString(36).substr(2, 9)}...`,
          status: 'success',
          timestamp: new Date().toLocaleTimeString(),
        };
        newResults.push(result);
        setResults([...newResults]);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Update stats
      const stored = localStorage.getItem('solana-tools-stats');
      const stats = stored ? JSON.parse(stored) : { walletsGenerated: 0, tokensLaunched: 0, totalTransactions: 0, totalVolume: 0 };
      stats.totalTransactions += recipients.length;
      stats.totalVolume += recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
      localStorage.setItem('solana-tools-stats', JSON.stringify(stats));
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const totalAmount = recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Configuration Section */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-4">Multi Sender</h2>

        <div className="space-y-4">
          {/* Token Mint */}
          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2">
              Token Mint Address
            </label>
            <input
              type="text"
              value={tokenMint}
              onChange={(e) => setTokenMint(e.target.value)}
              placeholder="Enter SPL token mint address"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Sender Private Key */}
          <div>
            <label className="block text-slate-300 text-sm font-semibold mb-2">
              Sender Private Key (Base58)
            </label>
            <div className="flex gap-2">
              <input
                type={showPrivateKey ? 'text' : 'password'}
                value={senderPrivateKey}
                onChange={(e) => setSenderPrivateKey(e.target.value)}
                placeholder="Paste your private key here"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="p-2 hover:bg-slate-600 rounded transition-all"
              >
                {showPrivateKey ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recipients Management - Full Height */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 border border-slate-700 flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white">Recipients List</h3>
            <p className="text-slate-400 text-sm">Total: {recipients.length} | Amount: {totalAmount.toFixed(2)}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowBulkModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-all flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              Bulk Input
            </button>
            <button
              onClick={downloadTemplate}
              className="bg-slate-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-600 transition-all flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              Template
            </button>
            <label className="bg-slate-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-600 transition-all flex items-center gap-2 cursor-pointer text-sm">
              <Upload size={16} />
              CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
            </label>
            {recipients.length > 0 && (
              <>
                <button
                  onClick={downloadRecipients}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center gap-2 text-sm"
                >
                  <Download size={16} />
                  Export
                </button>
                <button
                  onClick={clearAllRecipients}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-all flex items-center gap-2 text-sm"
                >
                  <X size={16} />
                  Clear All
                </button>
              </>
            )}
          </div>
        </div>

        {/* Recipients Table - Full Scrollable Area */}
        <div className="flex-1 overflow-y-auto border border-slate-600 rounded-lg bg-slate-700 mb-4 min-h-0">
          <div className="grid grid-cols-12 gap-2 p-3 sticky top-0 bg-slate-800 border-b border-slate-600 font-semibold text-slate-300 text-sm">
            <div className="col-span-1">#</div>
            <div className="col-span-8">Recipient Address</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-1">Action</div>
          </div>

          <div className="divide-y divide-slate-600">
            {recipients.length > 0 ? (
              recipients.map((recipient, index) => (
                <div key={recipient.id} className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-slate-600 transition-all">
                  <div className="col-span-1 text-slate-300 font-mono text-sm">{index + 1}</div>
                  <div className="col-span-8">
                    <input
                      type="text"
                      value={recipient.address}
                      onChange={(e) => updateRecipient(recipient.id, 'address', e.target.value)}
                      placeholder="Solana address"
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={recipient.amount}
                      onChange={(e) => updateRecipient(recipient.id, 'amount', e.target.value)}
                      placeholder="0.00"
                      step="0.0001"
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => removeRecipient(recipient.id)}
                      className="p-1 hover:bg-red-600 rounded transition-all text-slate-400 hover:text-white w-full"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-400">
                <p>No recipients added yet. Use Bulk Input, CSV upload, or add manually.</p>
              </div>
            )}
          </div>
        </div>

        {/* Add Single Recipient Button */}
        {recipients.length > 0 && (
          <button
            onClick={addRecipient}
            className="w-full bg-slate-600 text-white py-2 rounded-lg font-semibold hover:bg-slate-500 transition-all flex items-center justify-center gap-2 mb-4"
          >
            <Plus size={18} />
            Add Another Recipient
          </button>
        )}

        {/* Send Button */}
        <button
          onClick={handleSendTokens}
          disabled={isSending || !tokenMint || !senderPrivateKey || recipients.length === 0}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          <Send size={18} />
          {isSending ? 'Sending...' : `Send to ${recipients.length} Recipients`}
        </button>
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 border border-slate-700 flex flex-col max-h-96">
          <h3 className="text-xl font-bold text-white mb-4 flex-shrink-0">Transaction Results ({results.length})</h3>
          <div className="space-y-2 overflow-y-auto flex-1">
            {results.map((result, index) => (
              <div
                key={index}
                className="bg-slate-700 rounded p-3 flex items-center justify-between border border-slate-600"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-mono text-sm truncate">{result.address}</p>
                  <p className="text-slate-400 text-xs">{result.amount} tokens</p>
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

      {/* Bulk Input Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700 max-w-2xl w-full max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-900">
              <h2 className="text-2xl font-bold text-white">Bulk Input Recipients</h2>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-2 hover:bg-slate-700 rounded transition-all"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <p className="text-slate-300 text-sm mb-3">
                  Paste addresses and amounts separated by commas, one per line:
                </p>
                <p className="text-slate-400 text-xs mb-2">Format: address, amount</p>
                <textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="9B5X4..., 100&#10;7kZ2M..., 50&#10;ABC123..., 75"
                  className="w-full h-48 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-sm resize-none"
                />
              </div>

              <div className="bg-blue-900 border border-blue-700 rounded-lg p-3 flex items-start gap-3">
                <p className="text-blue-200 text-sm">
                  💡 <strong>Tip:</strong> You can copy-paste from Excel, Google Sheets, or CSV files
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-slate-700 sticky bottom-0 bg-slate-900">
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 bg-slate-700 text-white py-2 rounded-lg font-semibold hover:bg-slate-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={parseBulkInput}
                disabled={!bulkInput.trim()}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Add {bulkInput.trim().split('\n').filter((l) => l.trim()).length} Recipients
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
