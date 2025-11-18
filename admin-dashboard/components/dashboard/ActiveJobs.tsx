import { FileText, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ActiveJobsProps {
  count: number;
  trend?: 'up' | 'down' | 'stable';
  change?: number;
}

export function ActiveJobs({ count, trend = 'stable', change }: ActiveJobsProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">Active Jobs</h3>
        <FileText className="w-8 h-8 text-blue-600" />
      </div>
      
      <p className="text-3xl font-bold text-gray-800">{count}</p>

      {change !== undefined && (
        <div className="mt-2 flex items-center space-x-1">
          {getTrendIcon()}
          <span className={`text-sm font-medium ${getTrendColor()}`}>
            {change > 0 ? '+' : ''}{change}
          </span>
          <span className="text-xs text-gray-500">from last hour</span>
        </div>
      )}
    </div>
  );
}
