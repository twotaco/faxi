import { Activity, TrendingUp, Clock, CheckCircle } from 'lucide-react';

interface ProcessingMetrics {
  successRate: number;
  avgAccuracy: number;
  avgConfidence: number;
  avgProcessingTime: number;
}

interface ProcessingMetricsCardProps {
  metrics: ProcessingMetrics;
}

export function ProcessingMetricsCard({ metrics }: ProcessingMetricsCardProps) {
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.9) return 'text-green-600';
    if (accuracy >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Success Rate */}
      <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-gray-700">Success Rate</h4>
          </div>
        </div>
        <div className={`text-3xl font-bold ${getSuccessRateColor(metrics.successRate)}`}>
          {metrics.successRate.toFixed(1)}%
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              metrics.successRate >= 95 ? 'bg-green-500' : 
              metrics.successRate >= 80 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(metrics.successRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Average Accuracy */}
      <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h4 className="font-semibold text-gray-700">Avg Accuracy</h4>
          </div>
        </div>
        <div className={`text-3xl font-bold ${getAccuracyColor(metrics.avgAccuracy)}`}>
          {(metrics.avgAccuracy * 100).toFixed(1)}%
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Vision interpretation accuracy
        </p>
      </div>

      {/* Average Confidence */}
      <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h4 className="font-semibold text-gray-700">Avg Confidence</h4>
          </div>
        </div>
        <div className={`text-3xl font-bold ${getAccuracyColor(metrics.avgConfidence)}`}>
          {(metrics.avgConfidence * 100).toFixed(1)}%
        </div>
        <p className="text-sm text-gray-500 mt-2">
          AI confidence scores
        </p>
      </div>

      {/* Average Processing Time */}
      <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-orange-600" />
            <h4 className="font-semibold text-gray-700">Avg Processing Time</h4>
          </div>
        </div>
        <div className="text-3xl font-bold text-gray-800">
          {formatTime(metrics.avgProcessingTime)}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Per fax processing
        </p>
      </div>
    </div>
  );
}
