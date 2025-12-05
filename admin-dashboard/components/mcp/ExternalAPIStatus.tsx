import { CheckCircle, XCircle, AlertTriangle, Globe } from 'lucide-react';

interface ExternalAPI {
  name: string;
  status: 'up' | 'down' | 'degraded';
}

interface ExternalAPIStatusProps {
  apis: ExternalAPI[];
}

export function ExternalAPIStatus({ apis }: ExternalAPIStatusProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'down':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (apis.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No external API data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {apis.map((api) => (
          <div
            key={api.name}
            className="flex items-center justify-between p-4 rounded-lg border-2 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Globe className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-semibold text-gray-800">{api.name}</p>
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border mt-1 ${getStatusColor(api.status)}`}>
                  {getStatusText(api.status)}
                </span>
              </div>
            </div>
            {getStatusIcon(api.status)}
          </div>
        ))}
      </div>
    </div>
  );
}
