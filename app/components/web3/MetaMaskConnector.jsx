'use client';

import React, { useState, useEffect } from 'react';
import { useMetaMask } from './MetaMaskProvider';

const MetaMaskConnector = () => {
  const { evmClient, isInitializing, error: initError } = useMetaMask();
  const [account, setAccount] = useState(null);
  const [chain, setChain] = useState(null);
  const [balance, setBalance] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  // Load saved session from localStorage
  useEffect(() => {
    const savedSession = localStorage.getItem('metaMaskSession');
    if (savedSession) {
      try {
        const { sessionId: savedSessionId } = JSON.parse(savedSession);
        setSessionId(savedSessionId);
      } catch (err) {
        console.error('Failed to restore session:', err);
      }
    }
  }, []);

  const connectWallet = async () => {
    if (!evmClient) {
      setError('MetaMask client not initialized');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request connection
      const session = await evmClient.connect();

      // Store session data
      const sessionData = {
        sessionId: session.sessionId,
        connectedAt: new Date().toISOString(),
      };
      localStorage.setItem('metaMaskSession', JSON.stringify(sessionData));
      setSessionId(session.sessionId);

      // Get active account
      if (session.accounts && session.accounts.length > 0) {
        const activeAccount = session.accounts[0];
        setAccount(activeAccount);

        // Get chain info
        const chainId = session.chainId;
        setChain(chainId);

        // Fetch balance
        await fetchBalance(activeAccount, chainId);
      }
    } catch (err) {
      console.error('Connection failed:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchBalance = async (address, chainId) => {
    try {
      const provider = evmClient.getProvider();
      const balanceWei = await provider.getBalance(address);
      const balanceEth = balanceWei.toString() / 1e18;
      setBalance(balanceEth.toFixed(4));
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setChain(null);
    setBalance(null);
    setSessionId(null);
    localStorage.removeItem('metaMaskSession');
  };

  const switchNetwork = async (chainId) => {
    try {
      await evmClient.switchChain(chainId);
      setChain(chainId);
      if (account) {
        await fetchBalance(account, chainId);
      }
    } catch (err) {
      console.error('Failed to switch network:', err);
      setError(`Failed to switch to chain ${chainId}`);
    }
  };

  if (isInitializing) {
    return <div className="p-4 text-center">Initializing MetaMask...</div>;
  }

  if (initError) {
    return <div className="p-4 text-center text-red-600">Error: {initError}</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">MetaMask Wallet Connection</h2>

      {!account ? (
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition"
        >
          {isConnecting ? 'Connecting...' : 'Connect MetaMask Wallet'}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Connected Account</p>
            <p className="font-mono text-lg font-bold break-all">{account}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Chain ID</p>
              <p className="font-bold text-lg">{chain}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Balance</p>
              <p className="font-bold text-lg">{balance} ETH</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => switchNetwork('0x1')}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Ethereum
            </button>
            <button
              onClick={() => switchNetwork('0x89')}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded"
            >
              Polygon
            </button>
            <button
              onClick={() => switchNetwork('0x38')}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
            >
              BSC
            </button>
          </div>

          <button
            onClick={disconnectWallet}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          >
            Disconnect Wallet
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default MetaMaskConnector;
