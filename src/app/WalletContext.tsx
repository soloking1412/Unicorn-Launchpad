'use client';

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo } from 'react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

export const WalletConnectionProvider = ({ children }: { children: React.ReactNode }) => {
  // You can also provide a custom RPC endpoint
  const endpoint = useMemo(() => clusterApiUrl('devnet'), []);

  // Initialize wallet adapters
  const wallets = useMemo(() => [
    new PhantomWalletAdapter()
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}; 