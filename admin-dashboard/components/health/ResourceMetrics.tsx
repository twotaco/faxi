'use client';

import { Cpu, Clock } from 'lucide-react';

interface ResourceMetricsProps {
  resources: {
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      percentage: number;
    };
    uptime: number;
  };
}

export function ResourceMetrics({ resources }: ResourceMetricsProps) {
  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getMemoryColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getMemoryBgColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-600';
    if (percentage >= 75) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Metrics</h3>
      
      <div className="space-y-6">
        {/* Memory Usage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Memory Usage</span>
            </div>
            <span className={`text-sm font-semibold ${getMemoryColor(resources.memoryUsage.percentage)}`}>
              {resources.memoryUsage.percentage}%
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full ${getMemoryBgColor(resources.memoryUsage.percentage)} transition-all duration-300`}
              style={{ width: `${resources.memoryUsage.percentage}%` }}
            />
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            {formatBytes(resources.memoryUsage.heapUsed)} / {formatBytes(resources.memoryUsage.heapTotal)}
          </div>
        </div>

        {/* Uptime */}
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">System Uptime</span>
          </div>
          <span className="text-sm font-semibold text-blue-600">
            {formatUptime(resources.uptime)}
          </span>
        </div>
      </div>
    </div>
  );
}
