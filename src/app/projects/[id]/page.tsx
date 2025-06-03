'use client';

import { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';
import { PublicKey } from '@solana/web3.js';
import TokenTrading from '@/components/TokenTrading';

interface Project {
  authority: PublicKey;
  name: string;
  symbol: string;
  fundingGoal: number;
  totalRaised: number;
  tokenPrice: number;
  isActive: boolean;
}

export default function ProjectPage({ params }: { params: { id: string } }) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      if (!wallet.connected || !wallet.publicKey) {
        setLoading(false);
        return;
      }

      try {
        const provider = new AnchorProvider(
          connection,
          new SolanaWallet(wallet),
          { commitment: 'confirmed' }
        );
        const client = new UnicornFactoryClient(provider);
        const projectPda = new PublicKey(params.id);
        const projectData = await client.getProject(projectPda);
        setProject(projectData);
      } catch (err) {
        console.error('Error fetching project:', err);
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [wallet.connected, wallet.publicKey, connection, params.id]);

  if (!wallet.connected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Connect your wallet to view project details</h2>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Loading project...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-red-500">{error || 'Project not found'}</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Project Details */}
          <div className="bg-gray-800/50 p-6 rounded-xl">
            <h1 className="text-3xl font-bold mb-4">{project.name}</h1>
            <div className="space-y-4">
              <div>
                <span className="text-gray-400">Token Symbol:</span>
                <span className="ml-2">{project.symbol}</span>
              </div>
              <div>
                <span className="text-gray-400">Funding Goal:</span>
                <span className="ml-2">{project.fundingGoal / 1e9} SOL</span>
              </div>
              <div>
                <span className="text-gray-400">Total Raised:</span>
                <span className="ml-2">{project.totalRaised / 1e9} SOL</span>
              </div>
              <div>
                <span className="text-gray-400">Status:</span>
                <span className={`ml-2 ${project.isActive ? 'text-green-500' : 'text-red-500'}`}>
                  {project.isActive ? 'Active' : 'Completed'}
                </span>
              </div>
            </div>
          </div>

          {/* Token Trading */}
          <TokenTrading
            projectToken={new PublicKey(params.id)}
            projectName={project.name}
            tokenSymbol={project.symbol}
            currentPrice={project.tokenPrice}
          />
        </div>
      </div>
    </div>
  );
} 