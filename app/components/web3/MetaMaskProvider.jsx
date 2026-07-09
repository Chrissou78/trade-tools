'use client';

import React, { useState, useEffect } from 'react';
import { createEVMClient } from '@metamask/connect-evm';

const MetaMaskProvider = ({ children }) => {
  const [evmClient, setEvmClient] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeMetaMask = async () => {
      try {
        // Initialize MetaMask EVM client with Infura
        const client = await createEVMClient({
          infuraAPIKey: process.env.NEXT_PUBLIC_INFURA_API_KEY || 'YOUR_INFURA_KEY',
          chains: ['0x1', '0x89', '0x38'], // Ethereum, Polygon, BSC
        });
        setEvmClient(client);
      } catch (err) {
        console.error('MetaMask initialization failed:', err);
        setError(err.message);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeMetaMask();
  }, []);

  return (
    <MetaMaskContext.Provider value={{ evmClient, isInitializing, error }}>
      {children}
    </MetaMaskContext.Provider>
  );
};

const MetaMaskContext = React.createContext();

export const useMetaMask = () => {
  const context = React.useContext(MetaMaskContext);
  if (!context) {
    throw new Error('useMetaMask must be used within MetaMaskProvider');
  }
  return context;
};

export default MetaMaskProvider;
