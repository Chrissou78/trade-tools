'use client'

import { useState } from 'react'
import { Copy, Check, AlertCircle, Info } from 'lucide-react'
import bs58 from 'bs58'
import { isPhantomInstalled } from '@/app/utils/phantomIntegration'

export default function PhantomImportButton({ wallet }) {
  const [showInstructions, setShowInstructions] = useState(false)
  const [copied, setCopied] = useState(false)
  const [step, setStep] = useState(1)

  const getBase58PrivateKey = (secretKey) => {
    try {
      const buffer = Buffer.from(secretKey)
      return bs58.encode(buffer)
    } catch (err) {
      return 'Error converting key'
    }
  }

  const privateKeyBase58 = getBase58PrivateKey(wallet.secretKey)

  const copyPrivateKey = async () => {
    try {
      await navigator.clipboard.writeText(privateKeyBase58)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      alert('Failed to copy')
    }
  }

  if (!isPhantomInstalled()) {
    return null
  }

  return (
    <div className="space-y-3 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
      {!showInstructions ? (
        <button
          onClick={() => setShowInstructions(true)}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
        >
          👻 Import to Phantom
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">Import to Phantom Wallet</h4>
            <button
              onClick={() => setShowInstructions(false)}
              className="text-slate-400 hover:text-white text-lg"
            >
              ✕
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full transition ${
                  s <= step ? 'bg-purple-500' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Step 1: Copy Key */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Info className="text-purple-400 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-sm text-slate-300">
                  Click below to copy your private key, then open Phantom.
                </p>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <code className="text-xs text-purple-300 break-all font-mono">
                  {privateKeyBase58}
                </code>
              </div>
              <button
                onClick={copyPrivateKey}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition"
              >
                {copied ? (
                  <>
                    <Check size={16} className="text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy Private Key
                  </>
                )}
              </button>
              <button
                onClick={() => setStep(2)}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Next →
              </button>
            </div>
          )}

          {/* Step 2: Open Phantom */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Info className="text-purple-400 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-sm text-slate-300">
                  Open your Phantom wallet extension in your browser.
                </p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-white">📍 Phantom Steps:</p>
                <ol className="text-xs text-slate-300 space-y-1 ml-4 list-decimal">
                  <li>Click the Phantom icon in your browser toolbar</li>
                  <li>If not logged in, log in to your Phantom wallet</li>
                  <li>Navigate to the account menu</li>
                </ol>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Import Key */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Info className="text-purple-400 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-sm text-slate-300">
                  Look for "Import Private Key" option in Phantom menu.
                </p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-white">🔑 Phantom Import Steps:</p>
                <ol className="text-xs text-slate-300 space-y-1 ml-4 list-decimal">
                  <li>Click the account/wallet icon (usually top-right)</li>
                  <li>Select "Import Private Key" or "Add Account"</li>
                  <li>Choose "Import Private Key"</li>
                  <li>Paste your private key (you already copied it!)</li>
                </ol>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="text-amber-400 flex-shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-amber-300">
                  Make sure you're pasting the correct private key you copied earlier!
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm font-semibold text-emerald-300 mb-1">Import Complete!</p>
                <p className="text-xs text-emerald-200">
                  Your wallet is now available in Phantom. You can use it for transactions!
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-white mb-1">📝 What's next?</p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>Receive SOL to your new wallet address</li>
                  <li>Use it to interact with Solana dApps</li>
                  <li>Keep your private key safe and never share it</li>
                </ul>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
