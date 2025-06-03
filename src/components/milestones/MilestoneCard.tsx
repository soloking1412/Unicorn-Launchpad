'use client';

import React from 'react';
import { PublicKey } from '@solana/web3.js';
import { Milestone } from '@/lib/solana/program';

interface MilestoneCardProps {
  milestone: Milestone;
  projectId: string;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({ milestone, projectId }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{milestone.title}</h3>
          <p className="text-sm text-gray-500">Milestone ID: {milestone.milestoneId}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-gray-900">{milestone.amount} SOL</p>
          <p className="text-sm text-gray-500">
            {milestone.isCompleted ? 'Completed' : 'In Progress'}
          </p>
        </div>
      </div>

      <p className="text-gray-700 mb-4">{milestone.description}</p>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-500">
          <span>Status</span>
          <span className={milestone.isCompleted ? 'text-green-500' : 'text-yellow-500'}>
            {milestone.isCompleted ? 'Completed' : 'In Progress'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MilestoneCard; 