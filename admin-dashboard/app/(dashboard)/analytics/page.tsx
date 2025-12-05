'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { OverviewStats } from '@/components/analytics/OverviewStats';
import { FaxJobsChart } from '@/components/analytics/FaxJobsChart';
import { UserInsightsChart } from '@/components/analytics/UserInsightsChart';
import { OrderMetrics } from '@/components/analytics/OrderMetrics';
import { RefreshCw, BarChart3 } from 'lucide-react';

interface AnalyticsOverview {
  users: {
    total: number;
    byRegion: Record<string, number>;
    byAgeRange: Record<string, number>;
    byDigitalScore: Record<string, number>;
  };
  faxJobs: {
    total: number;
    last24Hours: number;
    byStatus: Record<string, number>;
    perDay: Array<{ date: string; count: number }>;
  };
  orders: {
    total: number;
    totalRevenue: number;
    byStatus: Record<string, number>;
  };
  processing: {
    avgAccuracy: number;
    avgConfidence: number;
    avgProcessingTime: number;
  };
}

async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  const response = await apiClient.get('/api/admin/dashboard/analytics/overview');
  return response.data;
}

export default function AnalyticsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: fetchAnalyticsOverview,
    refetchInterval: 60000, // Refresh every minute
  });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Failed to load analytics</h3>
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
            <BarChart3 className="w-8 h-8 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            System analytics and user behavior metrics
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
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Overview</h3>
            <OverviewStats data={data} />
          </div>

          {/* Fax Jobs Chart */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Fax Jobs (Last 30 Days)</h3>
            <FaxJobsChart data={data?.faxJobs} />
          </div>

          {/* User Insights and Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">User Insights</h3>
              <UserInsightsChart data={data?.users} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Metrics</h3>
              <OrderMetrics data={data?.orders} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
