'use client';

import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AccuracyMetrics as AccuracyMetricsType } from '@/lib/api/types';

interface AccuracyMetricsProps {
  data: AccuracyMetricsType;
}

export function AccuracyMetrics({ data }: AccuracyMetricsProps) {
  return (
    <div className="space-y-6">
      {/* Overall Accuracy */}
      <Card className="p-6">
        <h3 className="text-2xl font-bold mb-2">Overall Accuracy</h3>
        <div className="text-5xl font-bold text-primary">
          {(data.overall * 100).toFixed(1)}%
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Across all processing categories
        </p>
      </Card>

      {/* Breakdown by Category */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Accuracy by Category</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">OCR</div>
            <div className="text-3xl font-bold">
              {(data.byCategory.ocr * 100).toFixed(1)}%
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-500"
                style={{ width: `${data.byCategory.ocr * 100}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Annotation Detection</div>
            <div className="text-3xl font-bold">
              {(data.byCategory.annotationDetection * 100).toFixed(1)}%
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-500"
                style={{ width: `${data.byCategory.annotationDetection * 100}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Intent Classification</div>
            <div className="text-3xl font-bold">
              {(data.byCategory.intentClassification * 100).toFixed(1)}%
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-500"
                style={{ width: `${data.byCategory.intentClassification * 100}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Breakdown by Use Case */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Accuracy by Use Case</h3>
        <div className="space-y-3">
          {data.byUseCase.map((useCase) => (
            <div key={useCase.useCase} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{useCase.useCase}</span>
                <span className="text-sm font-bold">
                  {(useCase.accuracy * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-secondary h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-500"
                    style={{ width: `${useCase.accuracy * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  ({useCase.sampleCount} samples)
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Accuracy Trend Over Time */}
      {data.trend && data.trend.length > 0 && (
        <Card className="p-6">
          <h3 className="text-xl font-bold mb-4">Accuracy Trend Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis 
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString();
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="accuracy" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="Accuracy"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
