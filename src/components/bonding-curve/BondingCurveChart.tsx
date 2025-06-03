import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface BondingCurveChartProps {
  totalRaised: number;
  fundingGoal: number;
  currentPrice: number;
}

const BondingCurveChart: React.FC<BondingCurveChartProps> = ({
  totalRaised,
  fundingGoal,
  currentPrice,
}) => {
  // Generate data points for the bonding curve
  const generateDataPoints = () => {
    const points = [];
    const steps = 50;
    const stepSize = fundingGoal / steps;

    for (let i = 0; i <= steps; i++) {
      const x = i * stepSize;
      // Using a quadratic curve for the bonding curve
      const y = (x / fundingGoal) ** 2 * currentPrice;
      points.push({ x, y });
    }

    return points;
  };

  const dataPoints = generateDataPoints();

  const data = {
    labels: dataPoints.map(point => `$${point.x.toFixed(0)}`),
    datasets: [
      {
        label: 'Token Price',
        data: dataPoints.map(point => point.y),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.4,
      },
      {
        label: 'Current Position',
        data: dataPoints.map(point => point.x === totalRaised ? point.y : null),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        pointRadius: 6,
        pointHoverRadius: 8,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Bonding Curve',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `Price: $${context.parsed.y.toFixed(4)}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Amount Raised ($)',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Token Price ($)',
        },
      },
    },
  };

  return (
    <div className="w-full h-[400px] p-4 bg-white rounded-lg shadow-lg">
      <Line options={options} data={data} />
    </div>
  );
};

export default BondingCurveChart; 