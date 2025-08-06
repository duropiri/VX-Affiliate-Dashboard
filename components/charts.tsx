"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Line Chart Component
export function LineChart({ data }: { data: any }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center text-gray-500">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: data[0]?.data?.map((item: any) => item.x) || [],
    datasets: data.map((series: any) => ({
      label: series.id,
      data: series.data?.map((item: any) => item.y) || [],
      borderColor: series.color || '#3B82F6',
      backgroundColor: series.color || '#3B82F6',
      tension: 0.4,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div style={{ height: '400px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

// Bar Chart Component
export function BarChart({ data }: { data: any[] }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center text-gray-500">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: data.map(item => item.month),
    datasets: [
      {
        label: 'Revenue',
        data: data.map(item => item.revenue),
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
        borderWidth: 1,
      },
      {
        label: 'Referrals',
        data: data.map(item => item.referrals),
        backgroundColor: '#10B981',
        borderColor: '#10B981',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div style={{ height: '400px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}

// Pie Chart Component (using Doughnut for better UX)
export function PieChart({ data }: { data: any[] }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center text-gray-500">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: data.map(item => item.label),
    datasets: [
      {
        data: data.map(item => item.value),
        backgroundColor: data.map(item => item.color),
        borderColor: data.map(item => item.color),
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      title: {
        display: false,
      },
    },
  };

  return (
    <div style={{ height: '400px' }}>
      <Doughnut data={chartData} options={options} />
    </div>
  );
}

// Sample data generators for different chart types
export const generateLineChartData = () => {
  try {
    return [
      {
        id: 'Revenue',
        color: '#3B82F6',
        data: [
          { x: 'Jan', y: 1200 },
          { x: 'Feb', y: 1800 },
          { x: 'Mar', y: 2200 },
          { x: 'Apr', y: 1900 },
          { x: 'May', y: 2500 },
          { x: 'Jun', y: 2800 }
        ]
      },
      {
        id: 'Referrals',
        color: '#10B981',
        data: [
          { x: 'Jan', y: 5 },
          { x: 'Feb', y: 8 },
          { x: 'Mar', y: 12 },
          { x: 'Apr', y: 10 },
          { x: 'May', y: 15 },
          { x: 'Jun', y: 18 }
        ]
      }
    ];
  } catch (error) {
    console.error('Error generating line chart data:', error);
    return [];
  }
};

export const generateBarChartData = () => {
  try {
    return [
      { month: 'Jan', revenue: 1200, referrals: 5 },
      { month: 'Feb', revenue: 1800, referrals: 8 },
      { month: 'Mar', revenue: 2200, referrals: 12 },
      { month: 'Apr', revenue: 1900, referrals: 10 },
      { month: 'May', revenue: 2500, referrals: 15 },
      { month: 'Jun', revenue: 2800, referrals: 18 }
    ];
  } catch (error) {
    console.error('Error generating bar chart data:', error);
    return [];
  }
};

export const generatePieChartData = () => {
  try {
    return [
      { id: 'Direct', label: 'Direct', value: 35, color: '#3B82F6' },
      { id: 'Referrals', label: 'Referrals', value: 25, color: '#10B981' },
      { id: 'Social', label: 'Social Media', value: 20, color: '#F59E0B' },
      { id: 'Organic', label: 'Organic Search', value: 20, color: '#EF4444' }
    ];
  } catch (error) {
    console.error('Error generating pie chart data:', error);
    return [];
  }
};
