'use client';

import React, { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { UnicornFactoryClient } from '@/lib/solana/program';
import { AnchorProvider } from '@project-serum/anchor';
import { SolanaWallet } from '@/types/wallet';
import { PublicKey } from '@solana/web3.js';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartDataset
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface BondingCurveContainerProps {
  projectId: string;
}

// Define a more specific type for chart data points
interface ChartDataPoint {
  x: number;
  y: number;
}

const BondingCurveContainer: React.FC<BondingCurveContainerProps> = ({ projectId }) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<{
    totalRaised: number;
    tokenPrice: number;
    fundingGoal: number;
  } | null>(null);

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const fetchProjectData = async () => {
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

      const projectData = await client.getProject(projectPda);
      setProject({
        totalRaised: projectData.totalRaised,
        tokenPrice: projectData.tokenPrice,
        fundingGoal: projectData.fundingGoal,
      });
    } catch (err) {
      console.error('Error fetching project data:', err);
      setError('Failed to load project data');
    } finally {
      setLoading(false);
    }
  };

  const calculateBondingCurve = () => {
    if (!project) return null;

    const curvePoints: ChartDataPoint[] = [];
    // Use the same bonding curve formula as the Rust program:
    // price = 1 + (total_raised * 100) / funding_goal
    // Generate points up to the funding goal
    const step = project.fundingGoal / 100; // More steps for smoother curve if needed, 100 steps here
    for (let i = 0; i <= project.fundingGoal; i += step) {
      const totalRaisedSol = i / 1e9; // Convert lamports to SOL for calculation
      const fundingGoalSol = project.fundingGoal / 1e9; // Convert lamports to SOL

      // Calculate price using the program's formula
      // Ensure fundingGoalSol is not zero to avoid division by zero
      const price = 1 + (fundingGoalSol > 0 ? (totalRaisedSol * 100) / fundingGoalSol : 0);

      curvePoints.push({
        x: totalRaisedSol, // Total Raised in SOL
        y: price, // Token Price in SOL
      });
    }

    // Add a point at the origin (0 raised, initial price 1 SOL)
     curvePoints.unshift({ x: 0, y: 1 });

    // Add current project data point
    const currentPoint: ChartDataPoint = {
      x: project.totalRaised / 1e9, // Convert totalRaised lamports to SOL
      y: project.tokenPrice, // Use actual fetched token price
    };

    return { curvePoints, currentPoint };
  };

  if (loading) {
    return <div>Loading bonding curve...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!project) {
    return <div>No project data available</div>;
  }

  const curveData = calculateBondingCurve();
  if (!curveData) {
    return <div>Failed to calculate bonding curve</div>;
  }

  const { curvePoints, currentPoint } = curveData;

  const chartData: ChartData<'line', ChartDataPoint[], string> = {
    labels: [], // Labels are not needed when using x/y data points
    datasets: [
      {
        label: 'Bonding Curve',
        data: curvePoints,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        fill: false,
        pointRadius: 0, // Hide points on the curve line
      } as ChartDataset<'line', ChartDataPoint[]>, // Explicitly cast dataset type
      {
        label: 'Current State',
        data: [currentPoint],
        backgroundColor: 'rgb(255, 99, 132)', // Red color for the point
        borderColor: 'rgb(255, 99, 132)',
        pointRadius: 8, // Make the point larger
        pointHoverRadius: 10,
        showLine: false,
      } as ChartDataset<'line', ChartDataPoint[]>, // Explicitly cast dataset type
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'white', // Set legend text color to white
        },
      },
      title: {
        display: true,
        text: 'Bonding Curve',
        color: 'white', // Set title text color to white
      },
       tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            // Access x and y from data point object using context.raw
            if (context.raw) { // Check if raw data is available
              if (context.raw.y !== undefined) {
                 label += `${context.raw.y.toFixed(2)} SOL Token Price`;
              }
              if (context.raw.x !== undefined) {
                 label += ` at ${context.raw.x.toFixed(2)} SOL Raised`;
              }
            } else if (context.parsed) { // Fallback for parsed if raw is not available
               if (context.parsed.y !== null) {
                 label += `${context.parsed.y.toFixed(2)} SOL Token Price`;
               }
              if (context.parsed.x !== null) {
                 label += ` at ${context.parsed.x.toFixed(2)} SOL Raised`;
              }
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear' as const, // Specify linear scale for x-axis
        title: {
          display: true,
          text: 'Total Raised (SOL)',
          color: 'white', // Set x-axis title color to white
        },
        ticks: {
          color: 'white', // Set x-axis label color to white
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)', // Adjust grid line color for dark background
        },
      },
      y: {
        type: 'linear' as const, // Specify linear scale for y-axis
        title: {
          display: true,
          text: 'Token Price (SOL)',
          color: 'white', // Set y-axis title color to white
        },
        ticks: {
          color: 'white', // Set y-axis label color to white
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)', // Adjust grid line color for dark background
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
        <div className="bg-gray-800 p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold">Current Price</h3>
          <p className="text-2xl font-bold">{project.tokenPrice} SOL</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold">Total Raised</h3>
          <p className="text-2xl font-bold">{project.totalRaised / 1e9} SOL</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold">Funding Goal</h3>
          <p className="text-2xl font-bold">{project.fundingGoal / 1e9} SOL</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default BondingCurveContainer; 