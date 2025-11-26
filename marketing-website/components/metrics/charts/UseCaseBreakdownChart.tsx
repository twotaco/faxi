'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface UseCaseData {
  useCase: string;
  accuracy: number;
  sampleCount: number;
}

interface UseCaseBreakdownChartProps {
  data: UseCaseData[];
}

export function UseCaseBreakdownChart({ data }: UseCaseBreakdownChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="useCase" 
          tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis 
          domain={[0, 1]}
          tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
        />
        <Tooltip 
          formatter={(value: number, name: string) => {
            if (name === 'accuracy') {
              return [`${(value * 100).toFixed(1)}%`, 'Accuracy'];
            }
            return [value, name];
          }}
          labelFormatter={(label) => `Use Case: ${label}`}
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        <Legend />
        <Bar 
          dataKey="accuracy" 
          fill="hsl(var(--primary))" 
          name="Accuracy"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
