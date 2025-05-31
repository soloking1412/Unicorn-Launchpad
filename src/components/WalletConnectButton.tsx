'use client';

import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';

interface WalletConnectButtonProps {
  className?: string;
}

export const WalletConnectButton = ({ className }: WalletConnectButtonProps) => {
  const { setVisible } = useWalletModal();
  const { connected, connecting, disconnect } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = async () => {
    if (connected) {
      setShowDropdown(!showDropdown);
    } else {
      try {
        await setVisible(true);
      } catch (error) {
        console.error('Error opening wallet modal:', error);
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowDropdown(false);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  if (!mounted) {
    return (
      <button 
        className={`px-8 py-3 bg-gradient-to-r from-purple-400 to-pink-600 hover:from-purple-500 hover:to-pink-700 text-white rounded-md font-medium text-lg transition-colors ${className || ''}`}
      >
        Loading...
      </button>
    );
  }
  
  return (
    <div className="relative">
      <button 
        onClick={handleClick}
        disabled={connecting}
        className={`px-8 py-3 bg-gradient-to-r from-purple-400 to-pink-600 hover:from-purple-500 hover:to-pink-700 text-white rounded-md font-medium text-lg transition-colors ${className || ''} ${connecting ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {connecting ? "Connecting..." : connected ? "Connected" : "Connect Wallet"}
      </button>
      
      {showDropdown && connected && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-10">
          <button
            onClick={handleDisconnect}
            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
          >
            Disconnect Wallet
          </button>
        </div>
      )}
    </div>
  );
}; 