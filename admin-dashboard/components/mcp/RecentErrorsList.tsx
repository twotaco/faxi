import { AlertCircle, Clock, User } from 'lucide-react';

interface MCPError {
  toolServer: string;
  toolName: string;
  errorMessage: string;
  timestamp: Date;
  userId?: string;
}

interface RecentErrorsListProps {
  errors: MCPError[];
}

export function RecentErrorsList({ errors }: RecentErrorsListProps) {
  if (errors.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-green-600" />
          </div>
        </div>
        <p className="text-gray-600 font-medium">No recent errors</p>
        <p className="text-sm text-gray-500 mt-1">All MCP servers are operating normally</p>
      </div>
    );
  }

  const formatServerName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Server
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Tool
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Error Message
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                User
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {errors.map((error, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-gray-800">
                      {formatServerName(error.toolServer)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600 font-mono">
                    {error.toolName}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-800 max-w-md truncate" title={error.errorMessage}>
                    {error.errorMessage}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-1 text-sm text-gray-600">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimestamp(error.timestamp)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {error.userId ? (
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <User className="w-3 h-3" />
                      <span className="font-mono text-xs">{error.userId.slice(0, 8)}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
