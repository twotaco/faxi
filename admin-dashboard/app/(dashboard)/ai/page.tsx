'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ProcessingMetricsCard } from '@/components/ai/ProcessingMetricsCard';
import { RecentProcessingList } from '@/components/ai/RecentProcessingList';
import { RefreshCw, Brain } from 'lucide-react';

interface ProcessingMetrics {
  successRate: number;
  avgAccuracy: number;
  avgConfidence: number;
  avgProcessingTime: number;
}

interface ProcessingAttempt {
  id: string;
  faxJobId: string;
  metricType: string;
  accuracy: number;
  confidence: number;
  processingTime: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

interface AIMetricsResponse {
  aggregate: ProcessingMetrics;
  recentProcessing: ProcessingAttempt[];
}

async function fetchAIMetrics(): Promise<AIMetricsResponse> {
  const response = await apiClient.get('/api/admin/dashboard/ai/metrics');
  return response.data;
}

export default function AIPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-metrics'],
    queryFn: fetchAIMetrics,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Failed to load AI metrics</h3>
        <p className="text-red-600 text-sm mb-4">
          {error instanceof Error ? error.message : 'An error occurred'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <Brain className="w-8 h-8 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-800">AI Inspector</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Monitor AI vision interpretation performance and quality metrics
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
          <div className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      ) : (
        <>
          {/* Aggregate Metrics */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Aggregate Metrics (Last 24 Hours)
            </h3>
            <ProcessingMetricsCard metrics={data?.aggregate || {
              successRate: 0,
              avgAccuracy: 0,
              avgConfidence: 0,
              avgProcessingTime: 0,
            }} />
          </div>

          {/* Recent Processing Attempts */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Recent Processing Attempts (Last 20)
            </h3>
            <RecentProcessingList attempts={data?.recentProcessing || []} />
          </div>
        </>
      )}
    </div>
  );
}
