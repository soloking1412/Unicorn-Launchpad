'use client';

import React, { useState } from 'react';
import { PublicKey } from '@solana/web3.js';

interface ProposalFormProps {
  projectPda: PublicKey;
  onSubmit: (title: string, description: string, amount: number, milestoneId: number) => Promise<void>;
  onCancel: () => void;
}

const ProposalForm: React.FC<ProposalFormProps> = ({ projectPda, onSubmit, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number');
      return;
    }

    const milestoneIdNum = parseInt(milestoneId);
    if (isNaN(milestoneIdNum) || milestoneIdNum < 0) {
      setError('Milestone ID must be a non-negative number');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(title, description, amountNum, milestoneIdNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Enter proposal title"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Enter proposal description"
        />
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
          Amount (USD)
        </label>
        <input
          type="number"
          id="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Enter amount"
          min="0"
          step="0.01"
        />
      </div>

      <div>
        <label htmlFor="milestoneId" className="block text-sm font-medium text-gray-700">
          Milestone ID
        </label>
        <input
          type="number"
          id="milestoneId"
          value={milestoneId}
          onChange={(e) => setMilestoneId(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Enter milestone ID"
          min="0"
        />
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <div className="flex space-x-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Proposal'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default ProposalForm; 