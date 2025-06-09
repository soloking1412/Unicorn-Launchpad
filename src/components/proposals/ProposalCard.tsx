'use client';

import React from 'react';
import { PublicKey } from '@solana/web3.js';
import { Proposal } from '@/lib/solana/program';

interface ProposalCardProps {
  proposal: Proposal;
  projectId: string;
  onVote?: (proposalId: number, vote: boolean) => Promise<void>;
  canVote?: boolean;
  hasVoted?: boolean;
  userVote?: boolean | null;
  onReleaseFunds?: (proposalId: number) => Promise<void>;
  proposalId: number;
  milestoneAmount: number;
}

const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  projectId,
  onVote,
  canVote,
  hasVoted,
  userVote,
  onReleaseFunds,
  proposalId,
  milestoneAmount,
}) => {
  const totalVotes = proposal.yesVotes + proposal.noVotes;
  const yesPercentage = totalVotes > 0 ? (proposal.yesVotes / totalVotes) * 100 : 0;
  const noPercentage = totalVotes > 0 ? (proposal.noVotes / totalVotes) * 100 : 0;

  // Debugging logs for vote and release buttons
  console.log(`ProposalCard for proposalId: ${proposalId}`);
  console.log(`  proposal.isExecuted: ${proposal.isExecuted}`);
  console.log(`  canVote: ${canVote}`);
  console.log(`  votingEnd: ${new Date(proposal.votingEnd * 1000)} (current: ${new Date()})`);
  console.log(`  hasVoted: ${hasVoted}`);
  console.log(`  userVote: ${userVote}`);
  console.log(`  proposal.yesVotes: ${proposal.yesVotes}`);
  console.log(`  proposal.noVotes: ${proposal.noVotes}`);

  const getStatusColor = () => {
    if (proposal.isExecuted) return 'bg-green-500';
    if (new Date(proposal.votingEnd * 1000) < new Date()) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getStatusText = () => {
    if (proposal.isExecuted) return 'Executed';
    if (new Date(proposal.votingEnd * 1000) < new Date()) return 'Voting Ended';
    return 'Active';
  };

  return (
    <div className="bg-gray-700 rounded-lg shadow-lg p-6 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-xl font-semibold text-white">{proposal.title}</h3>
            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor()} text-white`}>
              {getStatusText()}
            </span>
          </div>
          <p className="text-gray-300 mb-4">{proposal.description}</p>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
            <div>
              <p>Amount: <span className="text-white">{milestoneAmount / 1e9} SOL</span></p>
              <p>Milestone ID: <span className="text-white">{proposal.milestoneId}</span></p>
            </div>
            <div>
              <p>Created: <span className="text-white">{new Date(proposal.createdAt * 1000).toLocaleDateString()}</span></p>
              <p>Voting Ends: <span className="text-white">{new Date(proposal.votingEnd * 1000).toLocaleDateString()}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Voting Progress */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-green-400">Yes: {proposal.yesVotes} ({yesPercentage.toFixed(1)}%)</span>
          <span className="text-red-400">No: {proposal.noVotes} ({noPercentage.toFixed(1)}%)</span>
        </div>
        <div className="w-full bg-gray-600 rounded-full h-2.5">
          <div
            className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${yesPercentage}%` }}
          />
        </div>
      </div>

      {/* Voting Buttons */}
      {!proposal.isExecuted && canVote && new Date(proposal.votingEnd * 1000) > new Date() && (
        <div className="flex space-x-4">
          <button
            onClick={(e) => { e.stopPropagation(); onVote?.(proposalId, true); }}
            disabled={hasVoted}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              hasVoted && userVote
                ? 'bg-green-600 text-white cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {hasVoted && userVote ? 'Voted Yes' : 'Vote Yes'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onVote?.(proposalId, false); }}
            disabled={hasVoted}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              hasVoted && !userVote
                ? 'bg-red-600 text-white cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {hasVoted && !userVote ? 'Voted No' : 'Vote No'}
          </button>
        </div>
      )}

      {/* Release Funds Button */}
      {!proposal.isExecuted && proposal.yesVotes > proposal.noVotes && new Date(proposal.votingEnd * 1000) < new Date() && (
        <button
          onClick={(e) => { e.stopPropagation(); onReleaseFunds?.(proposalId); }}
          className="w-full mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Release Funds
        </button>
      )}
    </div>
  );
};

export default ProposalCard; 