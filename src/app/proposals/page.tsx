'use client';

import React, { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';
import { PublicKey } from '@solana/web3.js';
import ProposalCard from '@/components/proposals/ProposalCard';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Proposal {
  creator: PublicKey;
  title: string;
  description: string;
  amount: number;
  milestoneId: number;
  yesVotes: number;
  noVotes: number;
  isExecuted: boolean;
  createdAt: number;
  votingEnd: number;
  projectId?: string; // Added to track which project the proposal belongs to
}

const ProposalsPage = () => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAllProposals();
  }, [wallet.connected]);

  const fetchAllProposals = async () => {
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
      
      // Fetch all projects first
      const projects = await client.getAllProjects();
      
      // Fetch proposals for each project
      const allProposals: Proposal[] = [];
      for (const project of projects) {
        const projectPda = await client.getProjectPda(project.authority);
        const proposalCount = project.proposalCount;

        // Fetch each proposal for this project
        const proposalPromises = Array.from({ length: proposalCount }, (_, i) =>
          client.getProposal(projectPda, i)
        );
        const projectProposals = await Promise.all(proposalPromises);
        
        // Add project ID to each proposal
        const proposalsWithProjectId = projectProposals.map(p => ({
          ...p,
          projectId: projectPda.toString()
        }));
        
        allProposals.push(...proposalsWithProjectId);
      }

      // Sort proposals by creation date (newest first)
      allProposals.sort((a, b) => b.createdAt - a.createdAt);
      
      setProposals(allProposals);
    } catch (err) {
      console.error('Error fetching proposals:', err);
      setError('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (projectId: string, proposalIndex: number, vote: boolean) => {
    if (!wallet.connected || !wallet.publicKey) {
      toast.error('Please connect your wallet to vote');
      return;
    }

    try {
      const provider = new AnchorProvider(
        connection,
        new SolanaWallet(wallet),
        { commitment: 'confirmed' }
      );
      const client = new UnicornFactoryClient(provider);
      const projectPda = new PublicKey(projectId);
      
      await client.vote(projectPda, proposalIndex, vote);
      toast.success('Vote recorded successfully');
      
      // Update local state
      setProposals(prev => prev.map((p, i) => 
        p.projectId === projectId && i === proposalIndex
          ? { ...p, [vote ? 'yesVotes' : 'noVotes']: p[vote ? 'yesVotes' : 'noVotes'] + 1 }
          : p
      ));
      setUserVotes(prev => ({ ...prev, [`${projectId}-${proposalIndex}`]: vote }));
    } catch (err) {
      console.error('Error voting:', err);
      toast.error('Failed to record vote');
    }
  };

  if (!wallet.connected) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Connect your wallet to view proposals</h2>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading proposals...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">All Proposals</h1>
          <Link 
            href="/"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Back to Home
          </Link>
        </div>

        {proposals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No proposals found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {proposals.map((proposal, index) => (
              <div key={`${proposal.projectId}-${index}`}>
                <div className="mb-2">
                  <Link 
                    href={`/projects/${proposal.projectId}`}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    View Project →
                  </Link>
                </div>
                <ProposalCard
                  proposal={proposal}
                  projectId={proposal.projectId || ''}
                  onVote={(proposalIndex, vote) => 
                    handleVote(proposal.projectId || '', proposalIndex, vote)
                  }
                  canVote={wallet.connected && !proposal.isExecuted}
                  hasVoted={proposal.projectId ? `${proposal.projectId}-${index}` in userVotes : false}
                  userVote={proposal.projectId ? userVotes[`${proposal.projectId}-${index}`] : null}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProposalsPage; 