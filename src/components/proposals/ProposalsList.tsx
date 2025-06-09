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
  milestoneId: number;
  yesVotes: number;
  noVotes: number;
  isExecuted: boolean;
  createdAt: number;
  votingEnd: number;
}

interface ProposalWithMilestoneAmount extends Proposal {
  milestoneAmount: number;
}

const ProposalsList: React.FC<ProposalsListProps> = ({ projectId }) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [proposals, setProposals] = useState<ProposalWithMilestoneAmount[]>([]);
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

      // Fetch each proposal and its associated milestone amount
      const proposalsWithMilestoneAmounts = await Promise.all(
        Array.from({ length: proposalCount }, async (_, i) => {
          const proposal = await client.getProposal(projectPda, i);
          const milestone = await client.getMilestone(projectPda, proposal.milestoneId);
          return { ...proposal, milestoneAmount: milestone.amount };
        })
      );
      setProposals(proposalsWithMilestoneAmounts);
    } catch (err: any) {
      console.error('Error fetching proposals:', err);
      setError('Failed to load proposals');
      toast.error(`Failed to load proposals: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposalIndex: number, vote: boolean) => {
    if (!wallet.connected || !wallet.publicKey) {
      toast.error('Please connect your wallet to vote');
      return;
    }

    const loadingToast = toast.loading('Submitting vote...');

    try {
      const provider = new AnchorProvider(
        connection,
        new SolanaWallet(wallet),
        { commitment: 'confirmed' }
      );
      const client = new UnicornFactoryClient(provider);
      const projectPda = new PublicKey(projectId);
      
      await client.vote(projectPda, proposalIndex, vote);
      toast.dismiss(loadingToast);
      toast.success('Vote recorded successfully');
      
      // Update local state and re-fetch proposals to get updated counts
      setProposals(prev => prev.map((p, i) => 
        i === proposalIndex 
          ? { ...p, [vote ? 'yesVotes' : 'noVotes']: p[vote ? 'yesVotes' : 'noVotes'] + 1 }
          : p
      ));
      setUserVotes(prev => ({ ...prev, [proposalIndex]: vote }));
      fetchProposals(); // Reload proposals after voting
    } catch (err: any) {
      console.error('Error voting:', err);
      toast.dismiss(loadingToast);
      toast.error(`Failed to record vote: ${err.message || String(err)}`);
    }
  };

  const handleReleaseFunds = async (proposalIndex: number) => {
    if (!wallet.connected || !wallet.publicKey) {
      toast.error('Please connect your wallet to release funds');
      return;
    }

    const loadingToast = toast.loading('Releasing funds...');

    try {
      const provider = new AnchorProvider(
        connection,
        new SolanaWallet(wallet),
        { commitment: 'confirmed' }
      );
      const client = new UnicornFactoryClient(provider);
      const projectPda = new PublicKey(projectId);

      // Find the proposal to get its milestoneId
      const proposal = proposals[proposalIndex];
      if (!proposal) {
          toast.dismiss(loadingToast);
          toast.error('Proposal not found');
          return;
      }

      console.log('handleReleaseFunds: projectPda', projectPda.toString());
      console.log('handleReleaseFunds: proposalIndex', proposalIndex);
      console.log('handleReleaseFunds: proposal.milestoneId', proposal.milestoneId);

      // Find the milestone PDA
      const [milestonePda, _milestoneBump] = await PublicKey.findProgramAddress(
          [Buffer.from('milestone'), projectPda.toBuffer(), Buffer.from([proposal.milestoneId])],
          client.programId
      );

      await client.releaseFunds(projectPda, proposalIndex, milestonePda);
      toast.dismiss(loadingToast);
      toast.success('Funds released successfully');

      // Update local state and re-fetch proposals
      setProposals(prev => prev.map((p, i) =>
        i === proposalIndex ? { ...p, isExecuted: true } : p
      ));
      fetchProposals(); // Reload proposals after fund release
    } catch (err: any) {
      console.error('Error releasing funds:', err);
      toast.dismiss(loadingToast);
      toast.error(`Failed to release funds: ${err.message || String(err)}`);
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
            hasVoted={index in userVotes}
            userVote={userVotes[index] ?? null}
            onReleaseFunds={handleReleaseFunds}
            proposalId={index}
            milestoneAmount={proposal.milestoneAmount}
          />
        </Link>
      ))}
    </div>
  );
};

export default ProposalsList; 