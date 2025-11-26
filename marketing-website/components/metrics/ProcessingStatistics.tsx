'use client';

import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { ProcessingStats } from '@/lib/api/types';

interface ProcessingStatisticsProps {
  data: ProcessingStats;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function ProcessingStatistics({ data }: ProcessingStatisticsProps) {
  // Transform confidence distribution for pie chart
  const confidenceChartData = data.confidenceDistribution.map((item) => ({
    name: item.range,
    value: item.count,
    percentage: item.percentage || (item.count / data.totalProcessed) * 100,
  }));

  return (
    <div className="space-y-6">
      {/* Key Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-2">Average Processing Time</div>
          <div className="text-3xl font-bold">
            {data.averageTime.toFixed(2)}s
          </div>
          {data.medianTime && (
            <div className="text-xs text-muted-foreground mt-1">
              Median: {data.medianTime.toFixed(2)}s
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-2">Success Rate</div>
          <div className="text-3xl font-bold text-green-600">
            {(data.successRate * 100).toFixed(1)}%
          </div>
          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mt-2">
            <div 
              className="bg-green-600 h-full transition-all duration-500"
              style={{ width: `${data.successRate * 100}%` }}
            />
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-2">Total Faxes Processed</div>
          <div className="text-3xl font-bold">
            {data.totalProcessed.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            All time
          </div>
        </Card>

        {data.p95Time && (
          <Card className="p-6">
            <div className="text-sm text-muted-foreground mb-2">95th Percentile Time</div>
            <div className="text-3xl font-bold">
              {data.p95Time.toFixed(2)}s
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              95% complete within this time
            </div>
          </Card>
        )}
      </div>

      {/* Confidence Score Distribution */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Confidence Score Distribution</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={confidenceChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {confidenceChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length] as string} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [
                  `${value} faxes`,
                  'Count'
                ]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-3">
            {confidenceChartData.map((item, index) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold">
                    {item.value} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-500"
                    style={{ 
                      width: `${item.percentage}%`,
                      backgroundColor: COLORS[index % COLORS.length]
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* By Use Case Statistics */}
      {data.byUseCase && data.byUseCase.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-bold mb-4">Statistics by Use Case</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Use Case</th>
                  <th className="text-right py-2 px-4">Avg Time</th>
                  <th className="text-right py-2 px-4">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.byUseCase.map((useCase) => (
                  <tr key={useCase.useCase} className="border-b">
                    <td className="py-2 px-4 font-medium">{useCase.useCase}</td>
                    <td className="text-right py-2 px-4">
                      {useCase.avgTime.toFixed(2)}s
                    </td>
                    <td className="text-right py-2 px-4">
                      <span className={useCase.successRate >= 0.9 ? 'text-green-600' : 'text-yellow-600'}>
                        {(useCase.successRate * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
