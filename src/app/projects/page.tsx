'use client';

import { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';
import { PublicKey } from '@solana/web3.js';
import Link from 'next/link';

interface Project {
  authority: PublicKey;
  name: string;
  symbol: string;
  fundingGoal: number;
  totalRaised: number;
  tokenPrice: number;
  isActive: boolean;
  pda: PublicKey;
}

export default function ProjectsPage() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
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
        
        // Fetch all projects
        const allProjects = await client.getAllProjects();

        // Calculate PDA for each project
        const projectsWithPda = await Promise.all(allProjects.map(async (project) => {
          const [pda] = await PublicKey.findProgramAddress(
            [Buffer.from('project'), project.authority.toBuffer()],
            client.programId // Use the public programId
          );
          return { ...project, pda };
        }));

        setProjects(projectsWithPda); // Set projects with PDA
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [wallet.connected, wallet.publicKey, connection]);

  if (!wallet.connected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Connect your wallet to view projects</h2>
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
            <h2 className="text-3xl font-bold">Loading projects...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-red-500">{error}</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Projects</h2>
          <p className="mt-3 text-gray-400">View and trade tokens for AI projects</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 ? (
            <div className="col-span-full text-center">
              <p className="text-xl text-gray-400">No projects found</p>
            </div>
          ) : (
            projects.map((project, index) => (
              <Link
                key={index}
                href={`/projects/${project.pda.toString()}`}
                className="bg-gray-800/50 p-6 rounded-xl hover:bg-gray-800/70 transition-colors"
              >
                <h3 className="text-xl font-semibold mb-4">{project.name}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Token:</span>
                    <span>{project.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Goal:</span>
                    <span>{project.fundingGoal / 1e9} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Raised:</span>
                    <span>{project.totalRaised / 1e9} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price:</span>
                    <span>{project.tokenPrice} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className={project.isActive ? 'text-green-500' : 'text-red-500'}>
                      {project.isActive ? 'Active' : 'Completed'}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 