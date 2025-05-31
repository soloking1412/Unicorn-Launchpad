'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';

export default function ProjectSubmission() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!wallet.connected || !wallet.publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData(e.currentTarget);
      const name = formData.get('projectName') as string;
      const symbol = formData.get('tokenSymbol') as string;
      const fundingGoal = Number(formData.get('fundingGoal'));

      const provider = new AnchorProvider(
        connection,
        new SolanaWallet(wallet),
        { commitment: 'confirmed' }
      );

      const client = new UnicornFactoryClient(provider);
      const tx = await client.initializeProject(name, symbol, fundingGoal);

      setSuccess(`Project created successfully! Transaction: ${tx}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Submit Your AI Project</h2>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg mb-6">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Project Name</label>
          <input
            type="text"
            name="projectName"
            required
            className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Token Symbol</label>
          <input
            type="text"
            name="tokenSymbol"
            required
            maxLength={5}
            className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Funding Goal (in SOL)</label>
          <input
            type="number"
            name="fundingGoal"
            required
            min="1"
            className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !wallet.connected}
          className={`w-full py-3 px-8 rounded-lg font-bold transition-colors ${
            isSubmitting || !wallet.connected
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Project'}
        </button>
      </form>
    </div>
  );
} 