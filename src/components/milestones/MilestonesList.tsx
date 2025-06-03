'use client';

import React, { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';
import { PublicKey } from '@solana/web3.js';

interface Milestone {
  title: string;
  description: string;
  amount: number;
  isCompleted: boolean;
  completedAt: number;
}

interface MilestonesListProps {
  projectId: string;
}

const MilestonesList: React.FC<MilestonesListProps> = ({ projectId }) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
  });

  useEffect(() => {
    fetchMilestones();
  }, [projectId]);

  const fetchMilestones = async () => {
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

      // Fetch project to get milestone count
      const project = await client.getProject(projectPda);
      const milestoneCount = project.milestoneCount;

      // Fetch each milestone
      const milestonePromises = Array.from({ length: milestoneCount }, (_, i) =>
        client.getMilestone(projectPda, i)
      );
      const fetchedMilestones = await Promise.all(milestonePromises);
      setMilestones(fetchedMilestones);
    } catch (err) {
      console.error('Error fetching milestones:', err);
      setError('Failed to load milestones');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.connected || !wallet.publicKey) {
      setError('Please connect your wallet first');
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

      // Fetch project to get the current milestone count
      const project = await client.getProject(projectPda);
      const milestoneIndex = project.milestoneCount;

      const amount = parseFloat(formData.amount) * 1_000_000_000; // Convert to lamports (1e9)
      if (isNaN(amount)) {
        setError('Invalid amount entered.');
        return;
      }

      await client.addMilestone(
        projectPda,
        milestoneIndex,
        formData.title,
        formData.description,
        amount // Pass the calculated numeric amount
      );

      // Reset form and refresh milestones
      setFormData({ title: '', description: '', amount: '' });
      setShowAddForm(false);
      fetchMilestones();
    } catch (err) {
      console.error('Error adding milestone:', err);
      setError('Failed to add milestone');
    }
  };

  const handleCompleteMilestone = async (milestoneId: number) => {
    if (!wallet.connected || !wallet.publicKey) {
      setError('Please connect your wallet first');
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

      await client.completeMilestone(projectPda, milestoneId);
      fetchMilestones();
    } catch (err) {
      console.error('Error completing milestone:', err);
      setError('Failed to complete milestone');
    }
  };

  if (loading) {
    return <div>Loading milestones...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Milestones</h2>
        {wallet.connected && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {showAddForm ? 'Cancel' : 'Add Milestone'}
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAddMilestone} className="space-y-4 bg-gray-800 p-4 rounded text-white">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full rounded-md border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-700 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-700 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Amount (SOL)</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              required
              min="0"
              step="0.1"
              className="mt-1 block w-full rounded-md border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-700 text-white"
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Add Milestone
          </button>
        </form>
      )}

      <div className="space-y-4">
        {milestones.map((milestone, index) => (
          <div
            key={index}
            className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700 text-white"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">{milestone.title}</h3>
                <p className="mt-1">{milestone.description}</p>
                <div className="mt-2 text-sm">
                  <p>Amount: {milestone.amount / 1e9} SOL</p>
                  <p>Status: {milestone.isCompleted ? 'Completed' : 'Pending'}</p>
                  {milestone.isCompleted && (
                    <p>Completed at: {new Date(milestone.completedAt * 1000).toLocaleString()}</p>
                  )}
                </div>
              </div>
              {!milestone.isCompleted && wallet.connected && (
                <button
                  onClick={() => handleCompleteMilestone(index)}
                  className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Complete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MilestonesList; 