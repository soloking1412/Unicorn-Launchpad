'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';
import { useRouter } from 'next/navigation';

export default function SubmitProject() {
  const router = useRouter();
  const wallet = useWallet();
  const { connection } = useConnection();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    projectName: '',
    description: '',
    videoUrl: '',
    teamMembers: '',
    fundingGoal: '',
    tokenName: '',
    tokenSymbol: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet.connected || !wallet.publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    console.log('Starting project submission...');
    console.log('Wallet connected:', wallet.publicKey.toString());
    console.log('Connection:', connection.rpcEndpoint);

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert funding goal to lamports (1 SOL = 1_000_000_000 lamports)
      const fundingGoalLamports = Math.floor(parseFloat(formData.fundingGoal) * 1_000_000_000);
      console.log('Funding goal in lamports:', fundingGoalLamports);

      const provider = new AnchorProvider(
        connection,
        new SolanaWallet(wallet),
        { commitment: 'confirmed' }
      );
      console.log('Provider created');

      const client = new UnicornFactoryClient(provider);
      console.log('Client created');
      
      console.log('Initializing project with:', {
        name: formData.projectName,
        symbol: formData.tokenSymbol,
        fundingGoal: fundingGoalLamports
      });
      
      // Initialize the project on-chain
      const tx = await client.initializeProject(
        formData.projectName,
        formData.tokenSymbol,
        fundingGoalLamports
      );
      console.log('Transaction signature:', tx);

      setSuccess(`Project submitted successfully! Transaction: ${tx}`);
      
      // Store additional project details in localStorage for now
      const projectDetails = {
        ...formData,
        txHash: tx,
        timestamp: new Date().toISOString(),
        owner: wallet.publicKey.toString(),
      };
      
      const existingProjects = JSON.parse(localStorage.getItem('projects') || '[]');
      localStorage.setItem('projects', JSON.stringify([...existingProjects, projectDetails]));

      // Redirect to projects page after 2 seconds
      setTimeout(() => {
        router.push('/projects');
      }, 2000);

    } catch (err) {
      console.error('Error details:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while submitting the project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white py-20">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">Submit Your AI Project</h1>
        
        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
            {error}
          </div>
        )}
        
        {success && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg text-green-500">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Project Name</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              value={formData.projectName}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Project Description</label>
            <textarea
              required
              rows={4}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Pitch Video URL</label>
            <input
              type="url"
              required
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              value={formData.videoUrl}
              onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Team Members (one per line)</label>
            <textarea
              required
              rows={3}
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              value={formData.teamMembers}
              onChange={(e) => setFormData({ ...formData, teamMembers: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Funding Goal (in SOL)</label>
            <input
              type="number"
              required
              min="1"
              step="0.1"
              className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              value={formData.fundingGoal}
              onChange={(e) => setFormData({ ...formData, fundingGoal: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Token Name</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                value={formData.tokenName}
                onChange={(e) => setFormData({ ...formData, tokenName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Token Symbol</label>
              <input
                type="text"
                required
                maxLength={5}
                className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                value={formData.tokenSymbol}
                onChange={(e) => setFormData({ ...formData, tokenSymbol: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !wallet.connected}
              className={`w-full bg-gradient-to-r from-purple-400 to-pink-600 hover:from-purple-500 hover:to-pink-700 text-white font-bold py-3 px-8 rounded-lg transition-colors ${
                (isSubmitting || !wallet.connected) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'Submitting...' : !wallet.connected ? 'Connect Wallet to Submit' : 'Submit Project'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
} 