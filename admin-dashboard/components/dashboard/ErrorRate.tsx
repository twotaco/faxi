import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ErrorRateProps {
  errors?: {
    count: number;
    rate: number;
    period: string;
  };
}

export function ErrorRate({ errors }: ErrorRateProps) {
  const rate = errors?.rate || 0;
  const count = errors?.count || 0;
  const isHealthy = rate < 5;
  const isWarning = rate >= 5 && rate < 10;
  const isCritical = rate >= 10;

  const getStatusColor = () => {
    if (isCritical) return 'text-red-600';
    if (isWarning) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusBg = () => {
    if (isCritical) return 'bg-red-50';
    if (isWarning) return 'bg-yellow-50';
    return 'bg-white';
  };

  return (
    <div className={`${getStatusBg()} p-6 rounded-lg shadow hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">Error Rate</h3>
        <AlertCircle className={`w-8 h-8 ${isCritical ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-green-600'}`} />
      </div>
      
      <p className={`text-3xl font-bold ${getStatusColor()}`}>
        {rate.toFixed(1)}%
      </p>

      <div className="mt-2 text-sm text-gray-600">
        {count} errors in {errors?.period || '1h'}
      </div>

      {isCritical && (
        <div className="mt-3 text-xs text-red-600 font-medium">
          ⚠️ High error rate detected
        </div>
      )}
    </div>
  );
}
