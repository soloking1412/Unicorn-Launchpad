'use client';

import React from 'react';
import { PublicKey } from '@solana/web3.js';
import { Milestone } from '@/lib/solana/program';

interface MilestoneCardProps {
  milestone: Milestone;
  projectId: string;
  milestoneId: number;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestone,
  projectId,
  milestoneId,
}) => {
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-white">{milestone.title}</h3>
          <p className="text-sm text-gray-500">Milestone ID: {milestoneId}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-white">{milestone.amount / 1_000_000_000} SOL</p>
          <p className="text-sm text-gray-500">
            {milestone.isCompleted ? 'Payment Released' : 'In Progress'}
          </p>
        </div>
      </div>

      <p className="text-gray-300 mb-4">{milestone.description}</p>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-500">
          <span>Status</span>
          <span className={milestone.isCompleted ? 'text-green-500' : 'text-yellow-500'}>
            {milestone.isCompleted ? 'Payment Released' : 'In Progress'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MilestoneCard; 