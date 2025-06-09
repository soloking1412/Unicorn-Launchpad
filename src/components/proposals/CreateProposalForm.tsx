import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';
import { PublicKey } from '@solana/web3.js';
import toast from 'react-hot-toast';

interface CreateProposalFormProps {
  projectId: string;
  onProposalCreated: () => void;
}

const CreateProposalForm: React.FC<CreateProposalFormProps> = ({ projectId, onProposalCreated }) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    milestoneId: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.connected || !wallet.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Creating proposal...');

    try {
      const provider = new AnchorProvider(
        connection,
        new SolanaWallet(wallet),
        { commitment: 'confirmed' }
      );
      const client = new UnicornFactoryClient(provider);
      const projectPda = new PublicKey(projectId);
      
      const milestoneId = parseInt(formData.milestoneId);

      // Check if a proposal already exists for this milestone
      try {
        const milestone = await client.getMilestone(projectPda, milestoneId);
        if (milestone.hasProposal) {
          toast.dismiss(loadingToast);
          toast.error(`A proposal for Milestone ID ${milestoneId} already exists.`);
          setLoading(false);
          return;
        }
      } catch (milestoneErr: any) {
        // If milestone not found, it's a valid scenario for creation, proceed.
        // If it's another error, re-throw or handle as appropriate.
        if (milestoneErr.message !== 'Milestone not found') {
          toast.dismiss(loadingToast);
          toast.error(`Error checking milestone: ${milestoneErr.message}`);
          setLoading(false);
          return;
        }
      }

      // Get the current proposal count (now handled by program.ts's createProposal)
      // const project = await client.getProject(projectPda);
      // const proposalIndex = project.proposalCount;

      await client.createProposal(
        projectPda,
        formData.title,
        formData.description,
        milestoneId
      );

      toast.dismiss(loadingToast);
      toast.success('Proposal created successfully');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        milestoneId: '',
      });

      // Notify parent component
      onProposalCreated();
    } catch (err: any) {
      console.error('Error creating proposal:', err);
      toast.dismiss(loadingToast);
      toast.error(`Failed to create proposal: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-800 p-6 rounded-lg">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">
          Title
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          required
          maxLength={32}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Enter proposal title"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          required
          maxLength={256}
          rows={4}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Enter proposal description"
        />
      </div>

      <div>
        <label htmlFor="milestoneId" className="block text-sm font-medium text-gray-300 mb-1">
          Milestone ID
        </label>
        <input
          type="number"
          id="milestoneId"
          name="milestoneId"
          value={formData.milestoneId}
          onChange={handleInputChange}
          required
          min="0"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Enter milestone ID"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full px-4 py-2 rounded-md text-white font-medium ${
          loading
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800'
        }`}
      >
        {loading ? 'Creating...' : 'Create Proposal'}
      </button>
    </form>
  );
};

export default CreateProposalForm; 