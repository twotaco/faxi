import { Server } from 'lucide-react';

interface ResourceUsageProps {
  system?: {
    uptime: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    activeConnections: number;
  };
}

export function ResourceUsage({ system }: ResourceUsageProps) {
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const memoryPercentage = system?.memoryUsage?.percentage || 0;
  const isMemoryHealthy = memoryPercentage < 70;
  const isMemoryWarning = memoryPercentage >= 70 && memoryPercentage < 90;
  const isMemoryCritical = memoryPercentage >= 90;

  const getMemoryColor = () => {
    if (isMemoryCritical) return 'bg-red-600';
    if (isMemoryWarning) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Resource Usage</h3>
        <Server className="w-6 h-6 text-blue-600" />
      </div>

      <div className="space-y-4">
        {/* Memory Usage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Memory Usage</span>
            <span className="text-sm font-semibold text-gray-800">
              {memoryPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getMemoryColor()}`}
              style={{ width: `${Math.min(memoryPercentage, 100)}%` }}
            />
          </div>
          {system?.memoryUsage && (
            <div className="text-xs text-gray-500 mt-1">
              {formatBytes(system.memoryUsage.used)} / {formatBytes(system.memoryUsage.total)}
            </div>
          )}
        </div>

        {/* Uptime */}
        {system?.uptime !== undefined && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <span className="text-sm text-gray-600">Uptime</span>
            <span className="text-sm font-semibold text-gray-800">
              {formatUptime(system.uptime)}
            </span>
          </div>
        )}

        {/* Active Connections */}
        {system?.activeConnections !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Active Connections</span>
            <span className="text-sm font-semibold text-gray-800">
              {system.activeConnections}
            </span>
          </div>
        )}

        {isMemoryCritical && (
          <div className="mt-3 text-xs text-red-600 font-medium">
            ⚠️ High memory usage detected
          </div>
        )}
      </div>
    </div>
  );
}
