'use client';

import React, { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';
import { PublicKey } from '@solana/web3.js';
import ProposalCard from './ProposalCard';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface ProposalsListProps {
  projectId: string;
}

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
}

const ProposalsList: React.FC<ProposalsListProps> = ({ projectId }) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchProposals();
  }, [wallet.connected, projectId]);

  const fetchProposals = async () => {
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
      const projectPda = new PublicKey(projectId);
      
      // Fetch project to get proposal count
      const project = await client.getProject(projectPda);
      const proposalCount = project.proposalCount;

      // Fetch each proposal
      const proposalPromises = Array.from({ length: proposalCount }, (_, i) =>
        client.getProposal(projectPda, i)
      );
      const proposalsData = await Promise.all(proposalPromises);
      setProposals(proposalsData);
    } catch (err) {
      console.error('Error fetching proposals:', err);
      setError('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposalIndex: number, vote: boolean) => {
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
        i === proposalIndex 
          ? { ...p, [vote ? 'yesVotes' : 'noVotes']: p[vote ? 'yesVotes' : 'noVotes'] + 1 }
          : p
      ));
      setUserVotes(prev => ({ ...prev, [proposalIndex]: vote }));
    } catch (err) {
      console.error('Error voting:', err);
      toast.error('Failed to record vote');
    }
  };

  const handleReleaseFunds = async (proposalIndex: number) => {
    if (!wallet.connected || !wallet.publicKey) {
      toast.error('Please connect your wallet to release funds');
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
      
      await client.releaseFunds(projectPda, proposalIndex);
      toast.success('Funds released successfully');
      
      // Update local state
      setProposals(prev => prev.map((p, i) => 
        i === proposalIndex ? { ...p, isExecuted: true } : p
      ));
    } catch (err) {
      console.error('Error releasing funds:', err);
      toast.error('Failed to release funds');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="mt-4 text-gray-400">Loading proposals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No proposals found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {proposals.map((proposal, index) => (
        <Link href={`/proposals/${projectId}/${index}`} key={index}>
          <ProposalCard
            proposal={proposal}
            projectId={projectId}
            onVote={handleVote}
            canVote={wallet.connected && !proposal.isExecuted}
            hasVoted={proposal.milestoneId in userVotes}
            userVote={userVotes[proposal.milestoneId] ?? null}
          />
        </Link>
      ))}
    </div>
  );
};

export default ProposalsList; 