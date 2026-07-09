'use client';

import { useState } from 'react';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Navigation from './components/Navigation';
import WalletGenerator from './components/WalletGenerator';
import TokenLauncher from './components/TokenLauncher';
import MultiSender from './components/MultiSender';
import MultiSwap from './components/MultiSwap';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'wallet':
        return <WalletGenerator />;
      case 'token':
        return <TokenLauncher />;
      case 'multisender':
        return <MultiSender />;
      case 'multiswap':
        return <MultiSwap />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navigation />
        <main className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
