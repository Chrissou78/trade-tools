'use client';

import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function PhantomImportGuide({ wallet, onClose, onImportComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Import Wallet to Phantom</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded transition-all"
          >
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Step 1: Copy Private Key */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              currentStep >= 1
                ? 'bg-slate-700 border-slate-600'
                : 'bg-slate-800 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'
                }`}
              >
                1
              </div>
              <h3 className="text-lg font-semibold text-white">Copy Your Private Key</h3>
            </div>
            <p className="text-slate-300 text-sm mb-3">Click below to copy your private key (you'll paste it into Phantom):</p>
            <div className="bg-slate-800 rounded p-3 flex items-center justify-between">
              <p className="text-slate-400 font-mono text-xs truncate">{wallet.secretKey}</p>
              <button
                onClick={() => copyToClipboard(wallet.secretKey)}
                className="ml-2 p-2 hover:bg-slate-700 rounded transition-all"
              >
                {copied ? (
                  <Check size={18} className="text-green-400" />
                ) : (
                  <Copy size={18} className="text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Open Phantom */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              currentStep >= 2
                ? 'bg-slate-700 border-slate-600'
                : 'bg-slate-800 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'
                }`}
              >
                2
              </div>
              <h3 className="text-lg font-semibold text-white">Open Phantom Wallet</h3>
            </div>
            <p className="text-slate-300 text-sm">Click the Phantom extension icon in your browser's top-right corner</p>
          </div>

          {/* Step 3: Navigate to Import */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              currentStep >= 3
                ? 'bg-slate-700 border-slate-600'
                : 'bg-slate-800 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'
                }`}
              >
                3
              </div>
              <h3 className="text-lg font-semibold text-white">Go to Settings</h3>
            </div>
            <p className="text-slate-300 text-sm">Tap the menu icon (☰) → Settings → Import Private Key</p>
          </div>

          {/* Step 4: Paste Key */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              currentStep >= 4
                ? 'bg-slate-700 border-slate-600'
                : 'bg-slate-800 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  currentStep >= 4 ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'
                }`}
              >
                4
              </div>
              <h3 className="text-lg font-semibold text-white">Paste & Confirm</h3>
            </div>
            <p className="text-slate-300 text-sm">Paste the private key you copied → Enter a name for the account → Click "Import"</p>
          </div>

          {/* Success Message */}
          <div className="bg-green-900 border border-green-700 rounded-lg p-4 flex items-start gap-3">
            <Check size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-200 font-semibold">✓ Done!</p>
              <p className="text-green-300 text-sm">Your wallet has been imported to Phantom and is ready to use.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 text-white py-2 rounded-lg font-semibold hover:bg-slate-600 transition-all"
          >
            Close
          </button>
          <button
            onClick={() => {
              onImportComplete();
              onClose();
            }}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
          >
            <Check size={18} />
            Imported Successfully
          </button>
        </div>
      </div>
    </div>
  );
}
