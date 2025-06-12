import { WalletContextState } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';

export class SolanaWallet {
  constructor(private wallet: WalletContextState) {}

  get publicKey(): PublicKey {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    return this.wallet.publicKey;
  }

  async signTransaction(tx: Transaction): Promise<Transaction> {
    if (!this.wallet.signTransaction) throw new Error('Wallet not connected');
    return await this.wallet.signTransaction(tx);
  }

  async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    if (!this.wallet.signAllTransactions) throw new Error('Wallet not connected');
    return await this.wallet.signAllTransactions(txs);
  }
} 