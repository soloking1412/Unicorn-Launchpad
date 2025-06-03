'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';
import { PublicKey, Connection } from '@solana/web3.js';
import BondingCurveContainer from '@/components/bonding-curve/BondingCurveContainer';
import ProposalsList from '@/components/proposals/ProposalsList';
import MilestonesList from '@/components/milestones/MilestonesList';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import toast from 'react-hot-toast';
import CreateProposalForm from '@/components/proposals/CreateProposalForm';
import Link from 'next/link';

interface ProjectPageProps {
  params: {
    id: string;
  };
}

interface ProjectData {
  authority: PublicKey;
  name: string;
  symbol: string;
  fundingGoal: number;
  totalRaised: number;
  tokenPrice: number;
  isActive: boolean;
  tokenMintAddress: PublicKey;
  proposalCount: number;
  milestoneCount: number;
}

interface Project extends ProjectData {
  tokenDecimals: number;
}

const ProjectPage: React.FC<ProjectPageProps> = ({ params }) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyAmount, setBuyAmount] = useState<string>('');
  const [sellAmount, setSellAmount] = useState<string>('');
  const [userTokenBalance, setUserTokenBalance] = useState<number>(0);
  const [showCreateProposal, setShowCreateProposal] = useState(false);

  // Move fetchProject outside useEffect and wrap with useCallback
  const fetchProject = useCallback(async () => {
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
      const projectPda = new PublicKey(params.id);
      
      // Fetch project details
      const projectData = await client.getProject(projectPda);

      // Fetch token mint info to get decimals using getParsedAccountInfo
      const tokenAccountInfo = await connection.getParsedAccountInfo(
        projectData.tokenMintAddress
      );

      // Extract decimals - safely access nested properties
      const decimals = (tokenAccountInfo.value?.data as any)?.parsed?.info?.decimals || 0;

      setProject({
        ...projectData,
        tokenDecimals: decimals, // Store decimals with project data
      });

      // Fetch user's token balance
      if (projectData.tokenMintAddress) {
        const userTokenAccount = await getAssociatedTokenAddress(
          projectData.tokenMintAddress,
          wallet.publicKey
        );
        // Check if the associated token account exists
        const userTokenAccountInfo = await connection.getParsedAccountInfo(userTokenAccount);

        if (userTokenAccountInfo.value) {
          // Account exists, get the balance
          const balance = (userTokenAccountInfo.value.data as any)?.parsed?.info?.tokenAmount?.amount;
          setUserTokenBalance(balance ? Number(balance) : 0);
        } else {
          // Account does not exist, balance is 0
          setUserTokenBalance(0);
        }
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  }, [wallet.connected, wallet.publicKey, connection, params.id]); // Add dependencies

  useEffect(() => {
    fetchProject();
  }, [fetchProject]); // Add fetchProject as a dependency

  const handleBuyTokens = async () => {
    if (!wallet.connected || !wallet.publicKey || !project) return;

    try {
      const provider = new AnchorProvider(
        connection,
        new SolanaWallet(wallet),
        { commitment: 'confirmed' }
      );
      const client = new UnicornFactoryClient(provider);
      const projectPda = new PublicKey(params.id);
      
      // Convert human-readable amount to the smallest unit
      const amount = parseFloat(buyAmount) * (10 ** project.tokenDecimals); // Use token decimals

      // Ensure the amount is an integer before converting to BigInt implicitly in the client
      if (!Number.isInteger(amount)) {
         throw new Error("Invalid buy amount. Please enter a valid number.");
      }

      await client.buyTokens(projectPda, amount);
      
      toast.success('Tokens purchased successfully!');

      // Refresh project data and user balance
      fetchProject();
      setBuyAmount('');
    } catch (err) {
      console.error('Error buying tokens:', err);
      toast.error(`Failed to buy tokens: ${err instanceof Error ? err.message : String(err)}`);
      setError(`Failed to buy tokens: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSellTokens = async () => {
    if (!wallet.connected || !wallet.publicKey || !project) return;

    try {
      const provider = new AnchorProvider(
        connection,
        new SolanaWallet(wallet),
        { commitment: 'confirmed' }
      );
      const client = new UnicornFactoryClient(provider);
      const projectPda = new PublicKey(params.id);
      
      // Convert human-readable amount to the smallest unit
      const amount = parseFloat(sellAmount) * (10 ** project.tokenDecimals); // Use token decimals

      // Ensure the amount is an integer before converting to BigInt implicitly in the client
      if (!Number.isInteger(amount)) {
         throw new Error("Invalid sell amount. Please enter a valid number.");
      }

      await client.sellTokens(projectPda, amount);
      
      toast.success('Tokens sold successfully!');

      // Refresh project data and user balance
      fetchProject();
      setSellAmount('');
    } catch (err) {
      console.error('Error selling tokens:', err);
      toast.error(`Failed to sell tokens: ${err instanceof Error ? err.message : String(err)}`);
      setError(`Failed to sell tokens: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (!wallet.connected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Connect your wallet to view project details</h2>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Loading project details...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-red-500">{error}</h2>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Project not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Project Overview Card */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-6">{project.name}</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Token Symbol:</span>
                <span className="font-semibold">{project.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Funding Goal:</span>
                <span className="font-semibold">{project.fundingGoal / 1e9} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Raised:</span>
                <span className="font-semibold">{project.totalRaised / 1e9} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current Price:</span>
                <span className="font-semibold">{project.tokenPrice} SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={`font-semibold ${project.isActive ? 'text-green-500' : 'text-red-500'}`}>
                  {project.isActive ? 'Active' : 'Completed'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Your Balance:</span>
                <span className="font-semibold">{userTokenBalance} tokens</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <label className="text-gray-400">Buy Tokens (SOL)</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    className="flex-1 p-2 border rounded bg-gray-700 text-white placeholder-gray-400"
                    placeholder="Amount in SOL"
                    disabled={!project.isActive}
                  />
                  <button
                    onClick={handleBuyTokens}
                    disabled={!project.isActive || !buyAmount || loading}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Buy
                  </button>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <label className="text-gray-400">Sell Tokens</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    className="flex-1 p-2 border rounded bg-gray-700 text-white placeholder-gray-400"
                    placeholder="Amount of tokens"
                    disabled={!project.isActive}
                  />
                  <button
                    onClick={handleSellTokens}
                    disabled={!project.isActive || !sellAmount || loading}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Sell
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bonding Curve Section */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">Bonding Curve</h2>
          <BondingCurveContainer projectId={params.id} />
        </div>

        {/* Proposals Section */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            {wallet.publicKey?.equals(project.authority) ? (
              <h2 className="text-2xl font-bold">Proposals</h2>
            ) : (
              <Link href="/proposals" className="text-2xl font-bold text-purple-400 hover:text-purple-300">
                Proposals →
              </Link>
            )}
            {wallet.publicKey?.equals(project.authority) && (
              <button
                onClick={() => setShowCreateProposal(!showCreateProposal)}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                {showCreateProposal ? 'Cancel' : 'Create Proposal'}
              </button>
            )}
          </div>

          {showCreateProposal && wallet.publicKey?.equals(project.authority) && (
            <div className="mb-6">
              <CreateProposalForm
                projectId={params.id}
                onProposalCreated={() => {
                  setShowCreateProposal(false);
                  fetchProject();
                }}
              />
            </div>
          )}

          <ProposalsList projectId={params.id} />
        </div>

        {/* Milestones Section */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Milestones</h2>
            {wallet.publicKey?.equals(project.authority) && (
              <button
                onClick={() => {/* Add milestone creation handler */}}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                Add Milestone
              </button>
            )}
          </div>
          <MilestonesList projectId={params.id} />
        </div>
      </div>
    </div>
  );
};

export default ProjectPage; 