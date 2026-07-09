'use client';

import React, { useState, useEffect } from 'react';
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import crypto from 'crypto';
import Papa from 'papaparse';

const WalletGenerator = () => {
  const [seedPhrase, setSeedPhrase] = useState('');
  const [walletCount, setWalletCount] = useState(1);
  const [generatedWallets, setGeneratedWallets] = useState([]);
  const [vanityMode, setVanityMode] = useState('none'); // 'none', 'prefix', 'suffix'
  const [vanityText, setVanityText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [visibleSecretKeys, setVisibleSecretKeys] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('walletGeneratorState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setSeedPhrase(parsed.seedPhrase || '');
        setWalletCount(parsed.walletCount || 1);
        setGeneratedWallets(parsed.generatedWallets || []);
        setVanityMode(parsed.vanityMode || 'none');
        setVanityText(parsed.vanityText || '');
        setShowSeedPhrase(parsed.showSeedPhrase || false);
        setVisibleSecretKeys(parsed.visibleSecretKeys || {});
      } catch (error) {
        console.error('Failed to load state from localStorage:', error);
      }
    }
    setIsLoading(false);
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (isLoading) return; // Don't save while loading

    const state = {
      seedPhrase,
      walletCount,
      generatedWallets,
      vanityMode,
      vanityText,
      showSeedPhrase,
      visibleSecretKeys,
    };
    localStorage.setItem('walletGeneratorState', JSON.stringify(state));
  }, [
    seedPhrase,
    walletCount,
    generatedWallets,
    vanityMode,
    vanityText,
    showSeedPhrase,
    visibleSecretKeys,
    isLoading,
  ]);

  // Derive wallet from seed phrase and index
  const deriveWalletFromSeed = (mnemonic, index) => {
    try {
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const hash = crypto
        .createHash('sha256')
        .update(Buffer.concat([seed, Buffer.from([index])]))
        .digest();

      const keypair = Keypair.fromSeed(hash.slice(0, 32));
      return {
        publicKey: keypair.publicKey.toBase58(),
        secretKey: Buffer.from(keypair.secretKey).toString('base64'),
      };
    } catch (error) {
      console.error('Derivation error:', error);
      return null;
    }
  };

  // Check if address matches vanity criteria
  const matchesVanity = (address) => {
    if (vanityMode === 'none') return true;
    if (vanityMode === 'prefix') return address.startsWith(vanityText);
    if (vanityMode === 'suffix') return address.endsWith(vanityText);
    return true;
  };

  // Generate new seed phrase and immediately generate wallets
  const generateNewSeed = async () => {
    const newSeed = bip39.generateMnemonic(256);
    setSeedPhrase(newSeed);

    // Generate wallets immediately after creating seed
    await generateWallets(newSeed, walletCount, vanityMode, vanityText);
  };

  // Generate wallets from seed
  const generateWallets = async (seed, count, mode, vanity) => {
    if (!seed.trim()) {
      alert('Please enter or generate a seed phrase');
      return;
    }

    if (!bip39.validateMnemonic(seed)) {
      alert('Invalid seed phrase');
      return;
    }

    if (count < 1 || count > 100) {
      alert('Wallet count must be between 1 and 100');
      return;
    }

    if (mode !== 'none' && !vanity.trim()) {
      alert('Please enter vanity text');
      return;
    }

    setIsGenerating(true);
    setGeneratedWallets([]);
    setGenerationProgress(0);
    setVisibleSecretKeys({});

    const wallets = [];
    let index = 0;
    let targetCount = count;

    try {
      while (wallets.length < targetCount && index < 1000000) {
        const wallet = deriveWalletFromSeed(seed, index);

        if (wallet && matchesVanity(wallet.publicKey)) {
          wallets.push({
            index,
            publicKey: wallet.publicKey,
            secretKey: wallet.secretKey,
            timestamp: new Date().toISOString(),
          });
          setGenerationProgress(
            Math.round((wallets.length / targetCount) * 100)
          );
        }

        index++;

        // Allow UI to update
        if (index % 100 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      if (wallets.length === 0) {
        alert('No wallets found with the specified vanity criteria');
      } else {
        setGeneratedWallets(wallets);
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert('Error generating wallets: ' + error.message);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  // Handle generate button click
  const handleGenerate = () => {
    generateWallets(seedPhrase, walletCount, vanityMode, vanityText);
  };

  // Toggle secret key visibility
  const toggleSecretKeyVisibility = (index) => {
    setVisibleSecretKeys((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Download wallets as JSON
  const downloadJSON = () => {
    if (generatedWallets.length === 0) {
      alert('No wallets to download');
      return;
    }

    const data = {
      seedPhrase,
      wallets: generatedWallets,
      generatedAt: new Date().toISOString(),
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wallets-${Date.now()}.json`;
    link.click();
  };

  // Download wallets as CSV
  const downloadCSV = () => {
    if (generatedWallets.length === 0) {
      alert('No wallets to download');
      return;
    }

    const csvData = [
      { Index: 'Seed Phrase', PublicKey: seedPhrase, SecretKey: '' },
      ...generatedWallets.map((wallet) => ({
        Index: wallet.index,
        PublicKey: wallet.publicKey,
        SecretKey: wallet.secretKey,
      })),
    ];

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wallets-${Date.now()}.csv`;
    link.click();
  };

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <p className="text-white text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 gap-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Wallet Generator
        </h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Panel - Settings */}
        <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">
          {/* Seed Phrase Section */}
          <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
            <h2 className="text-lg font-semibold text-cyan-400">Seed Phrase</h2>
            <div className="space-y-2">
              <button
                onClick={generateNewSeed}
                disabled={isGenerating}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-2 rounded transition"
              >
                {isGenerating ? 'Generating...' : 'Generate New Seed & Wallets'}
              </button>

              <div className="relative">
                <div className="flex gap-2 items-center">
                  <input
                    type={showSeedPhrase ? 'text' : 'password'}
                    placeholder="Enter your 24-word seed phrase or generate a new one"
                    value={seedPhrase}
                    onChange={(e) => setSeedPhrase(e.target.value)}
                    className="flex-1 bg-slate-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 h-10 font-mono text-xs"
                  />
                  {seedPhrase && (
                    <button
                      onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                      className="bg-slate-500 hover:bg-slate-400 px-3 py-2 rounded text-sm whitespace-nowrap"
                    >
                      {showSeedPhrase ? '🙈' : '👁️'}
                    </button>
                  )}
                </div>
              </div>

              {seedPhrase && (
                <button
                  onClick={() => copyToClipboard(seedPhrase, 'Seed phrase')}
                  className="w-full bg-slate-500 hover:bg-slate-400 px-3 py-2 rounded text-sm font-semibold"
                >
                  Copy Seed Phrase
                </button>
              )}

              <p className="text-xs text-yellow-400 bg-yellow-900/20 rounded p-2">
                ⚠️ Keep your seed phrase safe. Anyone with it can access all
                derived wallets.
              </p>
            </div>
          </div>

          {/* Generation Settings */}
          <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
            <h2 className="text-lg font-semibold text-cyan-400">
              Generation Settings
            </h2>

            <div>
              <label className="text-sm text-gray-300">Number of Wallets</label>
              <input
                type="number"
                placeholder="1"
                min="1"
                max="100"
                value={walletCount}
                onChange={(e) => setWalletCount(parseInt(e.target.value) || 1)}
                disabled={isGenerating}
                className="w-full bg-slate-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-sm text-gray-300">Vanity Mode</label>
              <select
                value={vanityMode}
                onChange={(e) => setVanityMode(e.target.value)}
                disabled={isGenerating}
                className="w-full bg-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              >
                <option value="none">None</option>
                <option value="prefix">Prefix Match</option>
                <option value="suffix">Suffix Match</option>
              </select>
            </div>

            {vanityMode !== 'none' && (
              <div>
                <label className="text-sm text-gray-300">Vanity Text</label>
                <input
                  type="text"
                  placeholder={
                    vanityMode === 'prefix'
                      ? 'e.g., ABC'
                      : 'e.g., XYZ'
                  }
                  value={vanityText}
                  onChange={(e) => setVanityText(e.target.value.toUpperCase())}
                  disabled={isGenerating}
                  className="w-full bg-slate-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                />
              </div>
            )}
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
              <h2 className="text-lg font-semibold text-cyan-400">Progress</h2>
              <div className="space-y-2">
                <div className="w-full bg-slate-600 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-300 text-center">
                  {generationProgress}% Complete
                </p>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !seedPhrase}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 rounded-lg transition"
          >
            {isGenerating ? `Generating... ${generationProgress}%` : 'Generate Wallets'}
          </button>

          {/* Download Buttons */}
          {generatedWallets.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={downloadJSON}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded transition"
              >
                Download JSON
              </button>
              <button
                onClick={downloadCSV}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded transition"
              >
                Download CSV
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Generated Wallets */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 rounded-lg p-4 border border-cyan-500/20">
              <p className="text-gray-400 text-sm">Total Wallets</p>
              <p className="text-3xl font-bold text-cyan-400">
                {generatedWallets.length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 rounded-lg p-4 border border-blue-500/20">
              <p className="text-gray-400 text-sm">Seed Type</p>
              <p className="text-lg font-bold text-blue-400">BIP39 (256-bit)</p>
            </div>
            <div className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 rounded-lg p-4 border border-purple-500/20">
              <p className="text-gray-400 text-sm">Generated</p>
              <p className="text-lg font-bold text-purple-400">
                {generatedWallets.length > 0
                  ? new Date(generatedWallets[0].timestamp).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Wallets List */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Generated Wallets
            </h2>
            <div className="flex-1 bg-slate-700/50 rounded-lg overflow-y-auto">
              {generatedWallets.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No wallets generated yet. Generate a seed and wallets will be
                  created.
                </div>
              ) : (
                <div className="space-y-2 p-3">
                  {generatedWallets.map((wallet, index) => (
                    <div
                      key={wallet.index}
                      className="bg-slate-600/50 rounded p-3 space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-semibold text-cyan-400">
                          Wallet #{index + 1} (Index {wallet.index})
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-400">
                            Public Key
                          </label>
                          <div className="flex gap-2 items-center">
                            <p className="text-xs text-gray-300 break-all font-mono bg-slate-700 rounded px-2 py-1 flex-1">
                              {wallet.publicKey}
                            </p>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  wallet.publicKey,
                                  'Public key'
                                )
                              }
                              className="bg-slate-500 hover:bg-slate-400 px-2 py-1 rounded text-xs whitespace-nowrap"
                            >
                              Copy
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-400">
                            Secret Key
                          </label>
                          <div className="flex gap-2 items-center">
                            <input
                              type={visibleSecretKeys[index] ? 'text' : 'password'}
                              value={wallet.secretKey}
                              readOnly
                              className="text-xs text-gray-300 font-mono bg-slate-700 rounded px-2 py-1 flex-1 focus:outline-none"
                            />
                            <button
                              onClick={() => toggleSecretKeyVisibility(index)}
                              className="bg-slate-500 hover:bg-slate-400 px-2 py-1 rounded text-xs whitespace-nowrap"
                            >
                              {visibleSecretKeys[index] ? '🙈' : '👁️'}
                            </button>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  wallet.secretKey,
                                  'Secret key'
                                )
                              }
                              className="bg-slate-500 hover:bg-slate-400 px-2 py-1 rounded text-xs whitespace-nowrap"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletGenerator;
