'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient, Proposal } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';
import { PublicKey } from '@solana/web3.js';
import ProposalCard from '@/components/proposals/ProposalCard';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const ProposalDetailsPage = () => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const params = useParams();
  const projectId = params.projectId as string;
  const proposalId = parseInt(params.proposalId as string);

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [isProjectOwner, setIsProjectOwner] = useState(false);

  const fetchProposal = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey || !projectId || isNaN(proposalId)) {
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

      // Fetch project to check if current user is owner
      const project = await client.getProject(projectPda);
      setIsProjectOwner(wallet.publicKey.equals(project.authority));

      // Fetch the specific proposal
      const fetchedProposal = await client.getProposal(projectPda, proposalId);
      setProposal(fetchedProposal);

      // TODO: Implement fetching user's vote status if needed

    } catch (err) {
      console.error('Error fetching proposal:', err);
      setError('Failed to load proposal details');
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, wallet.publicKey, connection, projectId, proposalId]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  const handleVote = async (vote: boolean) => {
    if (!wallet.connected || !wallet.publicKey || !proposal || !projectId || isNaN(proposalId)) {
      toast.error('Please connect your wallet and ensure proposal data is loaded to vote');
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
      
      await client.vote(projectPda, proposalId, vote);
      toast.success('Vote recorded successfully');
      
      // Update local state and re-fetch proposal to get updated counts
      setUserVote(vote); // Optimistically update local vote state
      fetchProposal(); // Re-fetch for accurate vote counts

    } catch (err) {
      console.error('Error voting:', err);
      toast.error('Failed to record vote');
    }
  };

    const handleReleaseFunds = async () => {
    if (!wallet.connected || !wallet.publicKey || !proposal || !projectId || isNaN(proposalId)) {
      toast.error('Please connect your wallet and ensure proposal data is loaded to release funds');
      return;
    }

     if (!isProjectOwner) {
        toast.error('Only the project owner can release funds.');
        return;
    }

    // Basic check if voting ended and proposal passed (more robust check is in program)
    const votingEnded = new Date(proposal.votingEnd * 1000) < new Date();
    const proposalPassed = proposal.yesVotes > proposal.noVotes;

    if (!votingEnded) {
        toast.error('Voting period has not ended yet.');
        return;
    }

     if (!proposalPassed) {
        toast.error('Proposal did not pass the vote.');
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
      
      await client.releaseFunds(projectPda, proposalId);
      toast.success('Funds released successfully!');
      
      // Re-fetch proposal to update status
      fetchProposal();

    } catch (err) {
      console.error('Error releasing funds:', err);
      toast.error('Failed to release funds');
    }
  };


  if (!wallet.connected) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Connect your wallet to view proposal details</h2>
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
            <p className="mt-4 text-gray-400">Loading proposal...</p>
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

  if (!proposal) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Proposal not found</h2>
          </div>
        </div>
      </div>
    );
  }

  // Check if voting has ended
  const now = new Date();
  const votingEndDate = new Date(proposal.votingEnd * 1000);
  const votingEnded = now > votingEndDate;

  // Check if proposal has passed
  const proposalPassed = proposal.yesVotes > proposal.noVotes;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Proposal Details</h1>
          <Link 
            href={`/projects/${projectId}`}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Back to Project
          </Link>
        </div>

        <ProposalCard
          proposal={proposal}
          projectId={projectId}
        />

         {/* Voting Buttons (re-implemented here for single proposal page) */}
        {!proposal.isExecuted && !votingEnded && wallet.connected && (
          <div className="flex space-x-4 mt-6">
            <button
              onClick={() => handleVote(true)}
              // disabled={hasVoted} // Placeholder
              className={
                'flex-1 px-4 py-2 rounded-lg transition-colors ' +
                (userVote === true ? 'bg-green-600 text-white cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white')
              }
            >
              Vote Yes
            </button>
            <button
              onClick={() => handleVote(false)}
              // disabled={hasVoted} // Placeholder
              className={
                 'flex-1 px-4 py-2 rounded-lg transition-colors ' +
                (userVote === false ? 'bg-red-600 text-white cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white')
              }
            >
              Vote No
            </button>
          </div>
        )}

        {/* Release Funds Button */}
        {!proposal.isExecuted && votingEnded && proposalPassed && isProjectOwner && (
          <button
            onClick={handleReleaseFunds}
            className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Release Funds ({proposal.amount / 1e9} SOL)
          </button>
        )}

      </div>
    </div>
  );
};

export default ProposalDetailsPage; 