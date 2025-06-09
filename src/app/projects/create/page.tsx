'use client';

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';
import { useRouter } from 'next/navigation';

const CreateProjectPage = () => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    fundingGoal: '',
    initialPrice: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.connected || !wallet.publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = new AnchorProvider(
        connection,
        new SolanaWallet(wallet),
        { commitment: 'confirmed' }
      );
      const client = new UnicornFactoryClient(provider);

      const fundingGoal = parseFloat(formData.fundingGoal) * 1e9; // Convert to lamports
      const initialPrice = parseFloat(formData.initialPrice);

      const tx = await client.initializeProject(
        formData.name,
        formData.symbol,
        fundingGoal
      );

      // Get the project PDA
      const projectPda = await client.getProjectPda(wallet.publicKey);

      // Redirect to the new project page
      router.push(`/projects/${projectPda.toBase58()}`);
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!wallet.connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Connect your wallet to create a project</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold mb-6">Create New Project</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Project Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter project name"
            />
          </div>

          <div>
            <label htmlFor="symbol" className="block text-sm font-medium text-gray-700">
              Token Symbol
            </label>
            <input
              type="text"
              id="symbol"
              name="symbol"
              value={formData.symbol}
              onChange={handleInputChange}
              required
              maxLength={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter token symbol (max 4 characters)"
            />
          </div>

          <div>
            <label htmlFor="fundingGoal" className="block text-sm font-medium text-gray-700">
              Funding Goal (SOL)
            </label>
            <input
              type="number"
              id="fundingGoal"
              name="fundingGoal"
              value={formData.fundingGoal}
              onChange={handleInputChange}
              required
              min="0"
              step="0.1"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter funding goal in SOL"
            />
          </div>

          <div>
            <label htmlFor="initialPrice" className="block text-sm font-medium text-gray-700">
              Initial Token Price (SOL)
            </label>
            <input
              type="number"
              id="initialPrice"
              name="initialPrice"
              value={formData.initialPrice}
              onChange={handleInputChange}
              required
              min="0"
              step="0.000001"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter initial token price in SOL"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            {loading ? 'Creating Project...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectPage; 