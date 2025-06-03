import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';

interface TokenTradingProps {
  projectToken: PublicKey;
  projectName: string;
  tokenSymbol: string;
  currentPrice: number;
}

export default function TokenTrading({ projectToken, projectName, tokenSymbol, currentPrice }: TokenTradingProps) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [amount, setAmount] = useState('');
  const [isTrading, setIsTrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleTrade = async (isBuy: boolean) => {
    if (!wallet.connected || !wallet.publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setIsTrading(true);
    setError(null);
    setSuccess(null);

    try {
      const provider = new AnchorProvider(
        connection,
        new SolanaWallet(wallet),
        { commitment: 'confirmed' }
      );
      const client = new UnicornFactoryClient(provider);
      const amountLamports = Math.floor(parseFloat(amount) * 1e9); // Convert to lamports

      if (isBuy) {
        const tx = await client.buyTokens(projectToken, amountLamports);
        setSuccess(`Successfully bought ${amount} ${tokenSymbol} tokens! Transaction: ${tx}`);
      } else {
        const tx = await client.sellTokens(projectToken, amountLamports);
        setSuccess(`Successfully sold ${amount} ${tokenSymbol} tokens! Transaction: ${tx}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsTrading(false);
    }
  };

  return (
    <div className="bg-gray-800/50 p-6 rounded-xl">
      <h3 className="text-xl font-semibold mb-4">Trade {projectName} Tokens</h3>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Amount ({tokenSymbol})</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            placeholder="Enter amount"
            min="0"
            step="0.01"
          />
        </div>

        <div className="text-sm text-gray-400">
          Current Price: {currentPrice} SOL per token
        </div>

        <div className="flex space-x-4">
          <button
            onClick={() => handleTrade(true)}
            disabled={isTrading || !wallet.connected}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              isTrading || !wallet.connected
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => handleTrade(false)}
            disabled={isTrading || !wallet.connected}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              isTrading || !wallet.connected
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            Sell
          </button>
        </div>
      </div>
    </div>
  );
} 