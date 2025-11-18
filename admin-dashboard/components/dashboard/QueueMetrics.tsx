import { Layers } from 'lucide-react';

interface QueueMetricsProps {
  queue?: {
    faxProcessing: number;
    emailToFax: number;
    total: number;
  };
}

export function QueueMetrics({ queue }: QueueMetricsProps) {
  const total = queue?.total || 0;
  const isHealthy = total < 50;
  const isWarning = total >= 50 && total < 100;
  const isCritical = total >= 100;

  const getStatusColor = () => {
    if (isCritical) return 'text-red-600';
    if (isWarning) return 'text-yellow-600';
    return 'text-gray-800';
  };

  const getStatusBg = () => {
    if (isCritical) return 'bg-red-50';
    if (isWarning) return 'bg-yellow-50';
    return 'bg-white';
  };

  return (
    <div className={`${getStatusBg()} p-6 rounded-lg shadow hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">Queue Size</h3>
        <Layers className={`w-8 h-8 ${isCritical ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-purple-600'}`} />
      </div>
      
      <p className={`text-3xl font-bold ${getStatusColor()}`}>{total}</p>

      {queue && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Fax Processing</span>
            <span className="font-medium text-gray-800">{queue.faxProcessing}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Email to Fax</span>
            <span className="font-medium text-gray-800">{queue.emailToFax}</span>
          </div>
        </div>
      )}

      {isCritical && (
        <div className="mt-3 text-xs text-red-600 font-medium">
          ⚠️ High queue backlog
        </div>
      )}
    </div>
  );
}
