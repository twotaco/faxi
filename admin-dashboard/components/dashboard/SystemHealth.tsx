import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface SystemHealthProps {
  health?: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      database: 'up' | 'down' | 'degraded';
      redis: 'up' | 'down' | 'degraded';
      s3: 'up' | 'down' | 'degraded';
      faxQueue: 'up' | 'down' | 'degraded';
      emailQueue: 'up' | 'down' | 'degraded';
    };
  };
}

export function SystemHealth({ health }: SystemHealthProps) {
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return <CheckCircle className="w-8 h-8 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-8 h-8 text-yellow-600" />;
      case 'unhealthy':
      case 'down':
        return <XCircle className="w-8 h-8 text-red-600" />;
      default:
        return <AlertTriangle className="w-8 h-8 text-gray-400" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'unhealthy':
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = (status?: string) => {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">System Health</h3>
        {getStatusIcon(health?.status)}
      </div>
      
      <p className={`text-3xl font-bold ${getStatusColor(health?.status)}`}>
        {getStatusText(health?.status)}
      </p>

      {health?.services && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          {Object.entries(health.services).map(([service, status]) => (
            <div key={service} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 capitalize">
                {service.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span className={`font-medium ${getStatusColor(status)}`}>
                {getStatusText(status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
