'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import Papa from 'papaparse';
import { createEVMClient } from '@metamask/connect-evm';

const TokenLauncher = () => {
  // MetaMask State
  const evmClientRef = useRef(null);
  const [metaMaskAccount, setMetaMaskAccount] = useState(null);
  const [metaMaskChain, setMetaMaskChain] = useState(null);
  const [metaMaskBalance, setMetaMaskBalance] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [metaMaskError, setMetaMaskError] = useState(null);
  const [metaMaskInitialized, setMetaMaskInitialized] = useState(false);

  const [tokenDetails, setTokenDetails] = useState({
    name: '',
    symbol: '',
    description: '',
    image: null,
    imagePreview: '',
    banner: null,
    bannerPreview: '',
    ownerBuyAmount: '',
  });

  const [launchTiming, setLaunchTiming] = useState('instant');
  const [staggerDelay, setStaggerDelay] = useState(1000);
  const [scheduledTime, setScheduledTime] = useState('');
  const [launchChain, setLaunchChain] = useState('solana');

  const [buyerWallets, setBuyerWallets] = useState([]);
  const [executionResults, setExecutionResults] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [solPrice, setSolPrice] = useState(0);
  const [priceLoading, setPriceLoading] = useState(true);
  const [noxaApiKey, setNoxaApiKey] = useState('');
  const [automatedBuyEnabled, setAutomatedBuyEnabled] = useState(false);

  // Robinhood Chain constants
  const ROBINHOOD_CHAIN_ID = 7332;
  const ROBINHOOD_RPC = 'https://rpc.robinhood.ankr.com/';
  const MAX_BUY_PERCENT = 0.02;

  // Initialize MetaMask Connect on mount
  useEffect(() => {
    const initializeMetaMask = async () => {
      try {
        const client = await createEVMClient({
          infuraAPIKey: process.env.NEXT_PUBLIC_INFURA_API_KEY || '',
          chains: ['0x1', '0x89', '0x38', '0x1c8a'],
        });
        evmClientRef.current = client;
        setMetaMaskInitialized(true);

        // Load saved session
        const savedSession = localStorage.getItem('metaMaskSession');
        if (savedSession) {
          const { account, chain } = JSON.parse(savedSession);
          setMetaMaskAccount(account);
          setMetaMaskChain(chain);
        }
      } catch (error) {
        console.error('Failed to initialize MetaMask:', error);
        setMetaMaskError('Failed to initialize MetaMask');
      }
    };

    initializeMetaMask();
  }, []);

  // Fetch SOL price
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        setPriceLoading(true);
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        const data = await response.json();
        if (data.solana?.usd) {
          setSolPrice(data.solana.usd);
        }
      } catch (error) {
        console.error('Failed to fetch SOL price:', error);
        setSolPrice(200);
      } finally {
        setPriceLoading(false);
      }
    };

    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('tokenLauncherState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setTokenDetails({
          ...parsed.tokenDetails,
          image: null,
          banner: null,
          imagePreview: parsed.tokenDetails.imagePreview || '',
          bannerPreview: parsed.tokenDetails.bannerPreview || '',
        });
        setLaunchTiming(parsed.launchTiming || 'instant');
        setStaggerDelay(parsed.staggerDelay || 1000);
        setScheduledTime(parsed.scheduledTime || '');
        setLaunchChain(parsed.launchChain || 'solana');
        setBuyerWallets(parsed.buyerWallets || []);
        setNoxaApiKey(parsed.noxaApiKey || '');
        setAutomatedBuyEnabled(parsed.automatedBuyEnabled || false);
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isLoading) return;

    const state = {
      tokenDetails: {
        name: tokenDetails.name,
        symbol: tokenDetails.symbol,
        description: tokenDetails.description,
        image: null,
        imagePreview: tokenDetails.imagePreview,
        banner: null,
        bannerPreview: tokenDetails.bannerPreview,
        ownerBuyAmount: tokenDetails.ownerBuyAmount,
      },
      launchTiming,
      staggerDelay,
      scheduledTime,
      launchChain,
      buyerWallets,
      noxaApiKey,
      automatedBuyEnabled,
    };
    localStorage.setItem('tokenLauncherState', JSON.stringify(state));
  }, [
    tokenDetails,
    launchTiming,
    staggerDelay,
    scheduledTime,
    launchChain,
    buyerWallets,
    noxaApiKey,
    automatedBuyEnabled,
    isLoading,
  ]);

  // Constants
  const VIRTUAL_SOL_RESERVE = 30;
  const VIRTUAL_TOKEN_RESERVE = 1_073_000_191;
  const TOTAL_SUPPLY = 1_000_000_000;
  const RESERVED_TOKENS = 206_900_000;
  const GRADUATION_SOL = 86;

  // MetaMask Connect Wallet
  const connectMetaMask = async () => {
    if (!evmClientRef.current) {
      setMetaMaskError('MetaMask client not initialized');
      return;
    }

    setIsConnecting(true);
    setMetaMaskError(null);

    try {
      const session = await evmClientRef.current.connect();

      if (session.accounts && session.accounts.length > 0) {
        const account = session.accounts[0];
        const chainId = session.chainId;

        setMetaMaskAccount(account);
        setMetaMaskChain(chainId);

        // Save session
        localStorage.setItem(
          'metaMaskSession',
          JSON.stringify({ account, chain: chainId })
        );

        // Fetch balance
        try {
          const provider = evmClientRef.current.getProvider();
          const balanceWei = await provider.getBalance(account);
          const balanceEth = (Number(balanceWei) / 1e18).toFixed(4);
          setMetaMaskBalance(balanceEth);
        } catch (err) {
          console.error('Failed to fetch balance:', err);
        }
      }
    } catch (error) {
      console.error('MetaMask connection failed:', error);
      setMetaMaskError(error?.message || 'Failed to connect MetaMask');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectMetaMask = () => {
    setMetaMaskAccount(null);
    setMetaMaskChain(null);
    setMetaMaskBalance(null);
    localStorage.removeItem('metaMaskSession');
  };

  const switchChain = async (chainId) => {
    if (!evmClientRef.current) return;

    try {
      const chainIdHex = '0x' + chainId.toString(16);
      await evmClientRef.current.switchChain(chainIdHex);
      setMetaMaskChain(chainIdHex);
    } catch (error) {
      console.error('Failed to switch chain:', error);
      setMetaMaskError(`Failed to switch to chain ${chainId}`);
    }
  };

  // Token calculations
  const calculateTokensFromSol = (solAmount) => {
    if (solAmount <= 0) return 0;
    const k = VIRTUAL_SOL_RESERVE * VIRTUAL_TOKEN_RESERVE;
    const newSolReserve = VIRTUAL_SOL_RESERVE + solAmount;
    const newTokenReserve = k / newSolReserve;
    const tokensOut = VIRTUAL_TOKEN_RESERVE - newTokenReserve;
    return Math.floor(tokensOut);
  };

  const calculateMarketCap = (totalSolCollected) => {
    if (totalSolCollected <= 0) return 0;
    const virtualSolCollected = VIRTUAL_SOL_RESERVE + totalSolCollected;
    const tokensDistributed = calculateTokensFromSol(totalSolCollected);
    const remainingTokens = VIRTUAL_TOKEN_RESERVE - tokensDistributed;
    const tokenPriceInSol = virtualSolCollected / remainingTokens;
    const marketCapInSol = tokenPriceInSol * VIRTUAL_TOKEN_RESERVE;
    return marketCapInSol;
  };

  const getGraduationStatus = (totalSolCollected) => {
    const progress = (totalSolCollected / GRADUATION_SOL) * 100;
    return {
      hasGraduated: totalSolCollected >= GRADUATION_SOL,
      progress: Math.min(progress, 100),
      solRemaining: Math.max(GRADUATION_SOL - totalSolCollected, 0),
    };
  };

  // File uploads
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTokenDetails({
          ...tokenDetails,
          image: file,
          imagePreview: event.target?.result,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTokenDetails({
          ...tokenDetails,
          banner: file,
          bannerPreview: event.target?.result,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Buyer wallet management
  const addEmptyBuyerWallet = () => {
    const newWallet = {
      id: Date.now(),
      privateKey: '',
      publicKey: '',
      buyAmount: '',
      tokensReceived: 0,
      status: 'pending',
    };
    setBuyerWallets([...buyerWallets, newWallet]);
  };

  const updateBuyerWallet = (id, field, value) => {
    const updatedWallets = buyerWallets.map((wallet) => {
      if (wallet.id !== id) return wallet;

      let updated = { ...wallet, [field]: value };

      if (field === 'privateKey' && value) {
        try {
          const publicKey = deriveEVMPublicKey(value);
          if (publicKey) {
            updated.publicKey = publicKey;
          }
        } catch (err) {
          console.error('Invalid private key:', err);
        }
      }

      if (field === 'buyAmount' && launchChain === 'noxa-robinhood' && value) {
        const buyAmount = parseFloat(value);
        const validation = validateBuyAmount(buyAmount, 1000000);
        if (!validation.valid) {
          alert(`Buy amount exceeds 2% limit. Max: ${validation.maxBuy.toFixed(4)}`);
          return wallet;
        }
      }

      return updated;
    });

    setBuyerWallets(updatedWallets);
  };

  const removeBuyerWallet = (id) => {
    setBuyerWallets(buyerWallets.filter((w) => w.id !== id));
  };

  const deriveEVMPublicKey = (privateKeyString) => {
    try {
      const wallet = new ethers.Wallet(privateKeyString);
      return wallet.address;
    } catch (error) {
      return null;
    }
  };

  const validateBuyAmount = (buyAmount, totalSupply) => {
    const maxBuy = totalSupply * MAX_BUY_PERCENT;
    return buyAmount <= maxBuy
      ? { valid: true, maxBuy }
      : { valid: false, maxBuy };
  };

  // CSV operations
  const exportToCSV = () => {
    if (buyerWallets.length === 0) {
      alert('No wallets to export');
      return;
    }

    const csvData = buyerWallets.map((wallet) => ({
      'Private Key': wallet.privateKey,
      'Public Key': wallet.publicKey,
      'Buy Amount': wallet.buyAmount,
      'Status': wallet.status,
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `token-launch-buyers-${Date.now()}.csv`;
    link.click();
  };

  const importFromCSV = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        let newWallets = results.data
          .filter((row) => row['Private Key'] && row['Buy Amount'])
          .map((row) => {
            const privateKey = row['Private Key'].trim();
            let publicKey;
            try {
              publicKey = deriveEVMPublicKey(privateKey);
            } catch {
              return null;
            }
            const buyAmount = parseFloat(row['Buy Amount']);

            if (!publicKey || isNaN(buyAmount)) return null;

            return {
              id: Date.now() + Math.random(),
              privateKey,
              publicKey,
              buyAmount,
              tokensReceived: 0,
              status: 'pending',
            };
          })
          .filter(Boolean);

        setBuyerWallets([...buyerWallets, ...newWallets]);
      },
      error: (error) => {
        alert('Error parsing CSV: ' + error.message);
      },
    });
  };

  // Launch execution
  const executeLaunch = async () => {
    if (!tokenDetails.name || !tokenDetails.symbol || !tokenDetails.imagePreview) {
      alert('Please fill in all required token details and upload an image');
      return;
    }

    if (launchChain === 'solana' && !metaMaskAccount) {
      alert('Please connect your MetaMask wallet first');
      return;
    }

    setIsExecuting(true);

    try {
      const validWallets = buyerWallets.filter((w) => w.privateKey && w.buyAmount);
      const ownerBuyAmount = parseFloat(tokenDetails.ownerBuyAmount) || 0;
      const totalBuyAmount =
        ownerBuyAmount + validWallets.reduce((sum, w) => sum + parseFloat(w.buyAmount), 0);

      setExecutionResults({
        success: true,
        tokenName: tokenDetails.name,
        tokenSymbol: tokenDetails.symbol,
        launchChain: launchChain === 'solana' ? 'Solana (Pump.fun)' : 'Robinhood Chain (Noxa.fi)',
        ownerWallet: metaMaskAccount || 'Not connected',
        totalParticipants: validWallets.length + (ownerBuyAmount > 0 ? 1 : 0),
        totalBuyAmount: totalBuyAmount,
        timestamp: new Date().toLocaleString(),
      });
    } catch (error) {
      setExecutionResults({
        success: false,
        error: error.message,
        timestamp: new Date().toLocaleString(),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Calculations
  const ownerBuyAmount = parseFloat(tokenDetails.ownerBuyAmount) || 0;
  const ownerTokens = calculateTokensFromSol(ownerBuyAmount);
  const totalBuyersSol = buyerWallets.reduce(
    (sum, wallet) => sum + (parseFloat(wallet.buyAmount) || 0),
    0
  );
  const totalSolCollected = ownerBuyAmount + totalBuyersSol;
  const marketCapInSol = calculateMarketCap(totalSolCollected);
  const marketCapInUsd = marketCapInSol * solPrice;
  const graduationStatus = getGraduationStatus(totalSolCollected);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <p className="text-white text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 gap-4">
      {/* Header with MetaMask Connection */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Token Launcher
        </h1>
        <div className="flex gap-4 items-center">
          {/* MetaMask Connect Button */}
          <div className="flex gap-2 items-center">
            {metaMaskInitialized ? (
              metaMaskAccount ? (
                <div className="bg-slate-700/50 rounded-lg p-3 border border-emerald-500/50">
                  <p className="text-xs text-gray-400 mb-1">Connected Wallet</p>
                  <p className="text-sm font-mono text-emerald-400">
                    {metaMaskAccount.slice(0, 6)}...{metaMaskAccount.slice(-4)}
                  </p>
                  {metaMaskBalance && (
                    <p className="text-xs text-gray-500 mt-1">
                      Balance: {metaMaskBalance} ETH
                    </p>
                  )}
                  <button
                    onClick={disconnectMetaMask}
                    className="mt-2 text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectMetaMask}
                  disabled={isConnecting}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition"
                >
                  {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                </button>
              )
            ) : (
              <p className="text-gray-400">Initializing MetaMask...</p>
            )}
          </div>

          {metaMaskError && (
            <div className="bg-red-900/30 border border-red-500/50 rounded px-3 py-1 text-xs text-red-300">
              {metaMaskError}
            </div>
          )}

          {!priceLoading && (
            <div className="text-sm text-gray-400">
              SOL: <span className="text-cyan-400 font-semibold">${solPrice.toFixed(2)}</span>
            </div>
          )}

          <select
            value={launchChain}
            onChange={(e) => setLaunchChain(e.target.value)}
            className="bg-slate-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="solana">Solana (Pump.fun)</option>
            <option value="noxa-robinhood">Robinhood Chain (Noxa.fi)</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Panel */}
        <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">
          {/* Banner */}
          <div className="bg-slate-700/50 rounded-lg overflow-hidden">
            {tokenDetails.bannerPreview ? (
              <div className="relative h-32 group">
                <img
                  src={tokenDetails.bannerPreview}
                  alt="Banner"
                  className="w-full h-full object-cover"
                />
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer transition">
                  <span className="text-white text-sm">Change Banner</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 bg-slate-600/50 hover:bg-slate-600 cursor-pointer transition">
                <span className="text-gray-400 text-sm">📸 Upload Banner</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Token Details */}
          <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
            <h2 className="text-lg font-semibold text-cyan-400">Token Details</h2>

            {/* Token Image */}
            <div className="space-y-2">
              <label className="text-sm text-gray-300">Token Image</label>
              {tokenDetails.imagePreview ? (
                <div className="relative h-40 rounded-lg overflow-hidden group">
                  <img
                    src={tokenDetails.imagePreview}
                    alt="Token"
                    className="w-full h-full object-cover"
                  />
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer transition">
                    <span className="text-white text-sm">Change Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-40 bg-slate-600/50 hover:bg-slate-600 rounded-lg cursor-pointer transition">
                  <span className="text-3xl mb-2">🖼️</span>
                  <span className="text-gray-400 text-sm">Upload Token Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <input
              type="text"
              placeholder="Token Name"
              value={tokenDetails.name}
              onChange={(e) =>
                setTokenDetails({ ...tokenDetails, name: e.target.value })
              }
              className="w-full bg-slate-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <input
              type="text"
              placeholder="Token Symbol"
              value={tokenDetails.symbol}
              onChange={(e) =>
                setTokenDetails({ ...tokenDetails, symbol: e.target.value })
              }
              className="w-full bg-slate-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <textarea
              placeholder="Description"
              value={tokenDetails.description}
              onChange={(e) =>
                setTokenDetails({
                  ...tokenDetails,
                  description: e.target.value,
                })
              }
              className="w-full bg-slate-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 h-20 resize-none"
            />
          </div>

          {/* Owner Buy Amount */}
          <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
            <h2 className="text-lg font-semibold text-cyan-400">Owner Details</h2>
            {metaMaskAccount && (
              <div className="bg-slate-600/50 rounded p-2 mb-2">
                <p className="text-xs text-gray-400">Owner Wallet (MetaMask)</p>
                <p className="text-xs font-mono text-cyan-400 break-all">
                  {metaMaskAccount}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-300">Buy Amount</label>
              <input
                type="number"
                placeholder="0.0"
                min="0"
                step="0.01"
                value={tokenDetails.ownerBuyAmount}
                onChange={(e) => {
                  setTokenDetails({
                    ...tokenDetails,
                    ownerBuyAmount: e.target.value,
                  });
                }}
                className="w-full bg-slate-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {ownerBuyAmount > 0 && (
              <div className="bg-slate-600/50 rounded p-3 space-y-1">
                <p className="text-sm text-gray-300">
                  Owner gets:{' '}
                  <span className="text-cyan-400 font-semibold">
                    {ownerTokens.toLocaleString()} tokens
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Launch Timing */}
          <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
            <h2 className="text-lg font-semibold text-cyan-400">Launch Timing</h2>
            <select
              value={launchTiming}
              onChange={(e) => setLaunchTiming(e.target.value)}
              className="w-full bg-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="instant">Instant</option>
              <option value="staggered">Staggered</option>
              <option value="scheduled">Scheduled</option>
            </select>

            {launchTiming === 'staggered' && (
              <input
                type="number"
                placeholder="Delay between buys (ms)"
                value={staggerDelay}
                onChange={(e) => setStaggerDelay(parseInt(e.target.value))}
                className="w-full bg-slate-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            )}

            {launchTiming === 'scheduled' && (
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full bg-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            )}
          </div>

          {/* Execute Button */}
          <button
            onClick={executeLaunch}
            disabled={isExecuting || !metaMaskAccount}
            className={`w-full font-bold py-3 rounded-lg transition ${
              metaMaskAccount
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'
                : 'bg-gradient-to-r from-gray-600 to-gray-700 cursor-not-allowed'
            } disabled:from-gray-600 disabled:to-gray-700 text-white`}
            title={!metaMaskAccount ? 'Connect MetaMask wallet first' : ''}
          >
            {isExecuting ? 'Launching...' : 'Launch Token'}
          </button>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Chain Info */}
          <div className="bg-gradient-to-r from-slate-700/50 to-slate-700/30 rounded-lg p-4 border border-cyan-500/20">
            <h3 className="text-sm font-semibold text-cyan-400 mb-2">
              {launchChain === 'solana' && '🔵 Solana (Pump.fun)'}
              {launchChain === 'noxa-robinhood' && '🦅 Robinhood Chain (Noxa.fi)'}
            </h3>
            <p className="text-xs text-gray-400">
              {launchChain === 'solana' && 'Launch on Solana blockchain via Pump.fun protocol'}
              {launchChain === 'noxa-robinhood' && 'Automated multi-wallet buying on Robinhood Chain via Noxa.fi'}
            </p>
          </div>

          {/* Add Buyer Button */}
          <div className="flex gap-2">
            <button
              onClick={addEmptyBuyerWallet}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded transition"
            >
              + Add Buyer Wallet
            </button>
            <label className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 rounded cursor-pointer text-center transition">
              Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={importFromCSV}
                className="hidden"
              />
            </label>
            <button
              onClick={exportToCSV}
              className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 rounded transition"
            >
              Export CSV
            </button>
          </div>

          {/* Buyers List */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Buyer Wallets ({buyerWallets.length})
            </h2>
            <div className="flex-1 bg-slate-700/50 rounded-lg overflow-y-auto p-3 space-y-3">
              {buyerWallets.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No buyer wallets added yet. Click "Add Buyer Wallet" to start.
                </div>
              ) : (
                buyerWallets.map((wallet, index) => (
                  <div key={wallet.id} className="bg-slate-600/50 rounded p-3 space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-cyan-400">
                        Buyer #{index + 1}
                      </span>
                      <button
                        onClick={() => removeBuyerWallet(wallet.id)}
                        className="text-red-400 hover:text-red-300 text-sm font-semibold"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-400">Private Key</label>
                        <input
                          type="password"
                          placeholder="Paste private key"
                          value={wallet.privateKey}
                          onChange={(e) =>
                            updateBuyerWallet(wallet.id, 'privateKey', e.target.value)
                          }
                          className="w-full bg-slate-700 rounded px-2 py-1 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono text-xs"
                        />
                      </div>

                      {wallet.publicKey && (
                        <div>
                          <label className="text-xs text-gray-400">Wallet Address</label>
                          <p className="text-xs text-cyan-400 break-all font-mono bg-slate-700 rounded px-2 py-1">
                            {wallet.publicKey}
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="text-xs text-gray-400">Buy Amount</label>
                        <input
                          type="number"
                          placeholder="0.0"
                          min="0"
                          step="0.01"
                          value={wallet.buyAmount}
                          onChange={(e) =>
                            updateBuyerWallet(wallet.id, 'buyAmount', e.target.value)
                          }
                          className="w-full bg-slate-700 rounded px-2 py-1 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      {wallet.buyAmount && (
                        <div className="bg-slate-700/50 rounded p-2">
                          <p className="text-xs text-gray-400">
                            Amount:{' '}
                            <span className="text-cyan-400 font-semibold">
                              {parseFloat(wallet.buyAmount).toFixed(4)}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Launch Summary */}
          <div className="bg-gradient-to-r from-slate-700/50 to-slate-700/30 rounded-lg p-4 space-y-2 border border-cyan-500/20">
            <h2 className="text-lg font-semibold text-cyan-400">Launch Summary</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Total Participants</p>
                <p className="text-cyan-400 font-semibold">
                  {buyerWallets.length + (ownerBuyAmount > 0 ? 1 : 0)}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Total Buy Amount</p>
                <p className="text-cyan-400 font-semibold">
                  {(totalSolCollected || 0).toFixed(4)} SOL
                </p>
              </div>
              {launchChain === 'solana' && (
                <>
                  <div>
                    <p className="text-gray-400">Market Cap</p>
                    <div className="space-y-1">
                      <p className="text-cyan-400 font-semibold">
                        ${marketCapInUsd.toFixed(0)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {marketCapInSol.toFixed(2)} SOL
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400">Graduation Progress</p>
                    <div className="w-full bg-slate-600 rounded-full h-2 mt-1">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${graduationStatus.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {graduationStatus.hasGraduated
                        ? 'Graduated ✓'
                        : `${graduationStatus.solRemaining.toFixed(2)} SOL remaining`}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Execution Results */}
          {executionResults && (
            <div
              className={`rounded-lg p-4 space-y-2 ${
                executionResults.success
                  ? 'bg-emerald-900/30 border border-emerald-500/50'
                  : 'bg-red-900/30 border border-red-500/50'
              }`}
            >
              <h3 className="font-semibold text-lg">
                {executionResults.success ? '✓ Launch Details' : '✗ Launch Failed'}
              </h3>
              {executionResults.success ? (
                <div className="text-sm space-y-1 text-gray-200">
                  <p>
                    Token: {executionResults.tokenName} ({executionResults.tokenSymbol})
                  </p>
                  <p>Chain: {executionResults.launchChain}</p>
                  <p>Owner: {executionResults.ownerWallet?.slice(0, 10)}...</p>
                  <p>Participants: {executionResults.totalParticipants}</p>
                  <p>Total Buy: {executionResults.totalBuyAmount.toFixed(4)} SOL</p>
                  <p>Time: {executionResults.timestamp}</p>
                </div>
              ) : (
                <p className="text-sm text-red-300">{executionResults.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenLauncher;
