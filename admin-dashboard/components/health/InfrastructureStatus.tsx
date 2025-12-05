'use client';

import { CheckCircle, AlertTriangle, XCircle, Database, Layers, HardDrive } from 'lucide-react';

interface InfrastructureStatusProps {
  infrastructure: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    s3: 'up' | 'down';
  };
}

export function InfrastructureStatus({ infrastructure }: InfrastructureStatusProps) {
  const getStatusIcon = (status: 'up' | 'down') => {
    if (status === 'up') {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  const getStatusColor = (status: 'up' | 'down') => {
    return status === 'up' ? 'text-green-600' : 'text-red-600';
  };

  const getStatusBg = (status: 'up' | 'down') => {
    return status === 'up' ? 'bg-green-50' : 'bg-red-50';
  };

  const services = [
    { name: 'Database', key: 'database', icon: Database, status: infrastructure.database },
    { name: 'Redis', key: 'redis', icon: Layers, status: infrastructure.redis },
    { name: 'S3 Storage', key: 's3', icon: HardDrive, status: infrastructure.s3 },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Infrastructure Status</h3>
      
      <div className="space-y-3">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <div
              key={service.key}
              className={`flex items-center justify-between p-4 rounded-lg ${getStatusBg(service.status)}`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">{service.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${getStatusColor(service.status)}`}>
                  {service.status.toUpperCase()}
                </span>
                {getStatusIcon(service.status)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
