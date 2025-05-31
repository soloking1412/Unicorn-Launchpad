'use client';

import { WalletConnectionProvider } from './WalletContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletConnectionProvider>
      {children}
    </WalletConnectionProvider>
  );
} 