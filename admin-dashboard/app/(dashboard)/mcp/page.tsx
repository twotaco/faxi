'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ServerStatsCard } from '@/components/mcp/ServerStatsCard';
import { RecentErrorsList } from '@/components/mcp/RecentErrorsList';
import { ExternalAPIStatus } from '@/components/mcp/ExternalAPIStatus';
import { RefreshCw, Server } from 'lucide-react';

interface MCPServer {
  name: string;
  totalCalls: number;
  successRate: number;
  failedCount: number;
  status: 'up' | 'degraded';
}

interface MCPError {
  toolServer: string;
  toolName: string;
  errorMessage: string;
  timestamp: Date;
  userId?: string;
}

interface ExternalAPI {
  name: string;
  status: 'up' | 'down' | 'degraded';
}

interface MCPStatsResponse {
  servers: MCPServer[];
  recentErrors: MCPError[];
  externalAPIs: ExternalAPI[];
}

async function fetchMCPStats(): Promise<MCPStatsResponse> {
  const response = await apiClient.get('/api/admin/dashboard/mcp/stats');
  return response.data;
}

export default function MCPPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mcp-stats'],
    queryFn: fetchMCPStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Failed to load MCP server stats</h3>
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
            <Server className="w-8 h-8 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-800">MCP Servers</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Monitor Model Context Protocol server performance and health
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Server Stats Grid */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Server Statistics (Last Hour)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.servers.map((server) => (
                <ServerStatsCard key={server.name} server={server} />
              ))}
            </div>
          </div>

          {/* External API Status */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">External API Health</h3>
            <ExternalAPIStatus apis={data?.externalAPIs || []} />
          </div>

          {/* Recent Errors */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Errors</h3>
            <RecentErrorsList errors={data?.recentErrors || []} />
          </div>
        </>
      )}
    </div>
  );
}
