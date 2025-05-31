'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { PublicKey, Connection } from '@solana/web3.js';

interface Project {
  authority: PublicKey;
  name: string;
  symbol: string;
  fundingGoal: number;
  totalRaised: number;
  tokenPrice: number;
  isActive: boolean;
}

export default function ProjectsPage() {
  const { publicKey, connected } = useWallet();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      if (!connected || !publicKey) {
        setLoading(false);
        return;
      }

      try {
        // Create connection and provider
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const provider = new AnchorProvider(
          connection,
          window.solana.wallet,
          { commitment: 'confirmed' }
        );
        const client = new UnicornFactoryClient(provider);

        // Get all projects
        const allProjects = await client.getAllProjects();
        setProjects(allProjects);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Failed to load projects');
        setLoading(false);
      }
    }

    fetchProjects();
  }, [connected, publicKey]);

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Connect your wallet to view projects
            </h2>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Loading projects...
            </h2>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              {error}
            </h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Projects
          </h2>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            View all projects on Unicorn Factory
          </p>
        </div>

        <div className="mt-12">
          {projects.length === 0 ? (
            <div className="text-center">
              <p className="text-xl text-gray-500">No projects found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project, index) => (
                <div
                  key={index}
                  className="bg-white overflow-hidden shadow rounded-lg"
                >
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900">
                      {project.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Symbol: {project.symbol}
                    </p>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Funding Goal:</span>
                        <span className="text-gray-900">
                          {project.fundingGoal / 1e9} SOL
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-500">Total Raised:</span>
                        <span className="text-gray-900">
                          {project.totalRaised / 1e9} SOL
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-500">Token Price:</span>
                        <span className="text-gray-900">
                          {project.tokenPrice} SOL
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-500">Status:</span>
                        <span
                          className={`${
                            project.isActive
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {project.isActive ? 'Active' : 'Completed'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 