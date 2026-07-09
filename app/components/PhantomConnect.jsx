'use client'

import { useState, useEffect } from 'react'
import { LogIn, LogOut, Wallet, Copy, Check } from 'lucide-react'
import { 
  isPhantomInstalled, 
  getPhantomProvider,
  connectPhantom, 
  disconnectPhantom 
} from '@/app/utils/phantomIntegration'

export default function PhantomConnect() {
  const [isConnected, setIsConnected] = useState(false)
  const [publicKey, setPublicKey] = useState(null)
  const [loading, setLoading] = useState(false)
  const [phantomInstalled, setPhantomInstalled] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setPhantomInstalled(isPhantomInstalled())

    // Check if already connected
    if (isPhantomInstalled()) {
      const provider = getPhantomProvider()
      provider.on('connect', (publicKey) => {
        setIsConnected(true)
        setPublicKey(publicKey.toString())
      })

      provider.on('disconnect', () => {
        setIsConnected(false)
        setPublicKey(null)
      })

      // Check current connection
      if (provider.isConnected) {
        setIsConnected(true)
        setPublicKey(provider.publicKey?.toString())
      }
    }
  }, [])

  const handleConnect = async () => {
    setLoading(true)
    const result = await connectPhantom()
    if (result.success) {
      setIsConnected(true)
      setPublicKey(result.publicKey)
    } else {
      alert('Failed to connect: ' + result.error)
    }
    setLoading(false)
  }

  const handleDisconnect = async () => {
    setLoading(true)
    const result = await disconnectPhantom()
    if (result.success) {
      setIsConnected(false)
      setPublicKey(null)
    }
    setLoading(false)
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(publicKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!phantomInstalled) {
    return (
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center gap-3">
        <span className="text-2xl">👻</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-yellow-300">Phantom Not Installed</p>
          <p className="text-xs text-yellow-200 mt-1">
            Download Phantom wallet extension to import wallets directly.
          </p>
        </div>
        <a
          href="https://phantom.app"
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded text-sm font-semibold transition"
        >
          Install
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      {!isConnected ? (
        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          <LogIn size={18} />
          {loading ? 'Connecting...' : 'Connect to Phantom'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-emerald-500/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <p className="text-xs text-slate-400">Connected</p>
                <p className="text-sm text-white font-mono font-semibold">{publicKey?.substring(0, 8)}...{publicKey?.substring(publicKey.length - 8)}</p>
              </div>
            </div>
            <button
              onClick={copyAddress}
              className={`transition p-1 ${copied ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            <LogOut size={18} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
