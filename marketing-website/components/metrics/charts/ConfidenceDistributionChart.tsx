'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ConfidenceData {
  range: string;
  count: number;
  percentage?: number;
}

interface ConfidenceDistributionChartProps {
  data: ConfidenceData[];
  totalProcessed: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function ConfidenceDistributionChart({ data, totalProcessed }: ConfidenceDistributionChartProps) {
  const chartData = data.map((item) => ({
    name: item.range,
    value: item.count,
    percentage: item.percentage || (item.count / totalProcessed) * 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length] as string} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number) => [
            `${value} faxes`,
            'Count'
          ]}
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
