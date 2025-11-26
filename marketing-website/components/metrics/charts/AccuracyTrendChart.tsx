'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TrendData {
  date: string;
  accuracy: number;
}

interface AccuracyTrendChartProps {
  data: TrendData[];
}

export function AccuracyTrendChart({ data }: AccuracyTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
          tickFormatter={(value) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }}
        />
        <YAxis 
          domain={[0, 1]}
          tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
        />
        <Tooltip 
          formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Accuracy']}
          labelFormatter={(label) => {
            const date = new Date(label);
            return date.toLocaleDateString();
          }}
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
          }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="accuracy" 
          stroke="hsl(var(--primary))" 
          strokeWidth={2}
          dot={{ r: 4, fill: 'hsl(var(--primary))' }}
          activeDot={{ r: 6 }}
          name="Accuracy"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
