'use client';

import { useDashboardMetrics } from '@/lib/hooks/useDashboardMetrics';
import { useDashboardStream } from '@/lib/hooks/useDashboardStream';
import { SystemHealth } from '@/components/dashboard/SystemHealth';
import { ActiveJobs } from '@/components/dashboard/ActiveJobs';
import { QueueMetrics } from '@/components/dashboard/QueueMetrics';
import { ErrorRate } from '@/components/dashboard/ErrorRate';
import { PerformanceMetrics } from '@/components/dashboard/PerformanceMetrics';
import { ResourceUsage } from '@/components/dashboard/ResourceUsage';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

export default function DashboardPage() {
  const { data: metrics, isLoading, error, refetch } = useDashboardMetrics();
  const { isConnected, lastUpdate, error: streamError } = useDashboardStream();

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Failed to load dashboard metrics</h3>
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
          <h2 className="text-2xl font-bold text-gray-800">Operations Dashboard</h2>
          <div className="flex items-center space-x-2 mt-1">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-600">Live updates active</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500">Auto-refresh every 30s</span>
              </>
            )}
            {lastUpdate && (
              <span className="text-xs text-gray-400">
                • Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
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

      {isLoading && !metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Top metrics row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <SystemHealth health={metrics?.health} />
            <ActiveJobs count={metrics?.jobs?.active || 0} />
            <QueueMetrics queue={metrics?.queue} />
            <ErrorRate errors={metrics?.errors} />
          </div>

          {/* Performance and resource usage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <PerformanceMetrics performance={metrics?.performance} />
            <ResourceUsage system={metrics?.system} />
          </div>

          {/* Recent jobs */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Jobs</h3>
            {metrics?.jobs?.recent && metrics.jobs.recent.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
                    <tr className="text-left text-gray-600">
                      <th className="pb-3 font-medium">Reference ID</th>
                      <th className="pb-3 font-medium">Direction</th>
                      <th className="pb-3 font-medium">From</th>
                      <th className="pb-3 font-medium">To</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {metrics.jobs.recent.map((job: any) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="py-3 font-mono text-xs">{job.referenceId || job.id.slice(0, 8)}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            job.direction === 'inbound' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {job.direction}
                          </span>
                        </td>
                        <td className="py-3 text-gray-600">{job.fromNumber}</td>
                        <td className="py-3 text-gray-600">{job.toNumber}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            job.status === 'completed' ? 'bg-green-100 text-green-800' :
                            job.status === 'failed' ? 'bg-red-100 text-red-800' :
                            job.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="py-3 text-gray-600">
                          {new Date(job.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No recent jobs</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
