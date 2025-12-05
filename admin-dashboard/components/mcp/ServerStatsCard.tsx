import { CheckCircle, AlertTriangle, Activity } from 'lucide-react';

interface MCPServer {
  name: string;
  totalCalls: number;
  successRate: number;
  failedCount: number;
  status: 'up' | 'degraded';
}

interface ServerStatsCardProps {
  server: MCPServer;
}

export function ServerStatsCard({ server }: ServerStatsCardProps) {
  const isLowSuccessRate = server.successRate < 95;
  
  const getStatusIcon = () => {
    if (isLowSuccessRate) {
      return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
    }
    return <CheckCircle className="w-6 h-6 text-green-600" />;
  };

  const getStatusColor = () => {
    if (isLowSuccessRate) {
      return 'border-yellow-300 bg-yellow-50';
    }
    return 'border-green-200 bg-white';
  };

  const formatServerName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className={`p-6 rounded-lg shadow hover:shadow-md transition-shadow border-2 ${getStatusColor()}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-gray-800">{formatServerName(server.name)}</h4>
        </div>
        {getStatusIcon()}
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Success Rate</span>
            <span className={`text-lg font-bold ${isLowSuccessRate ? 'text-yellow-700' : 'text-green-600'}`}>
              {server.successRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${isLowSuccessRate ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(server.successRate, 100)}%` }}
            />
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total Calls</span>
            <span className="font-semibold text-gray-800">{server.totalCalls}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Failed Calls</span>
            <span className={`font-semibold ${server.failedCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {server.failedCount}
            </span>
          </div>
        </div>
      </div>

      {isLowSuccessRate && (
        <div className="mt-4 pt-3 border-t border-yellow-200">
          <div className="flex items-center space-x-2 text-yellow-700">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium">Low success rate detected</span>
          </div>
        </div>
      )}
    </div>
  );
}
