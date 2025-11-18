import { Zap } from 'lucide-react';

interface PerformanceMetricsProps {
  performance?: {
    avgProcessingTime: number;
    percentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
    sampleSize: number;
  };
}

export function PerformanceMetrics({ performance }: PerformanceMetricsProps) {
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  const avgTime = performance?.avgProcessingTime || 0;
  const isGood = avgTime < 30;
  const isWarning = avgTime >= 30 && avgTime < 60;
  const isSlow = avgTime >= 60;

  return (
    <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Performance Metrics</h3>
        <Zap className={`w-6 h-6 ${isSlow ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-green-600'}`} />
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Avg Processing Time</span>
            <span className={`text-2xl font-bold ${isSlow ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-green-600'}`}>
              {formatTime(avgTime)}
            </span>
          </div>
          {performance && (
            <div className="text-xs text-gray-500">
              Based on {performance.sampleSize} samples
            </div>
          )}
        </div>

        {performance?.percentiles && (
          <div className="pt-4 border-t border-gray-100">
            <div className="text-sm font-medium text-gray-700 mb-3">Percentiles</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">P50</div>
                <div className="text-sm font-semibold text-gray-800">
                  {formatTime(performance.percentiles.p50)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">P95</div>
                <div className="text-sm font-semibold text-gray-800">
                  {formatTime(performance.percentiles.p95)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">P99</div>
                <div className="text-sm font-semibold text-gray-800">
                  {formatTime(performance.percentiles.p99)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
