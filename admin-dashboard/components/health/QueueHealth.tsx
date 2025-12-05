'use client';

import { Layers, Mail, FileText } from 'lucide-react';

interface QueueHealthProps {
  queues: {
    faxProcessing: number;
    emailToFax: number;
  };
}

export function QueueHealth({ queues }: QueueHealthProps) {
  const total = queues.faxProcessing + queues.emailToFax;
  
  const getQueueStatus = (size: number) => {
    if (size >= 100) return { color: 'text-red-600', bg: 'bg-red-50', status: 'Critical' };
    if (size >= 50) return { color: 'text-yellow-600', bg: 'bg-yellow-50', status: 'Warning' };
    return { color: 'text-green-600', bg: 'bg-green-50', status: 'Healthy' };
  };

  const totalStatus = getQueueStatus(total);

  const queueItems = [
    { name: 'Fax Processing', key: 'faxProcessing', icon: FileText, count: queues.faxProcessing },
    { name: 'Email to Fax', key: 'emailToFax', icon: Mail, count: queues.emailToFax },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Queue Health</h3>
        <div className="flex items-center gap-2">
          <Layers className={`w-5 h-5 ${totalStatus.color}`} />
          <span className={`text-sm font-medium ${totalStatus.color}`}>
            {totalStatus.status}
          </span>
        </div>
      </div>

      <div className={`mb-4 p-4 rounded-lg ${totalStatus.bg}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Total Queue Size</span>
          <span className={`text-2xl font-bold ${totalStatus.color}`}>{total}</span>
        </div>
      </div>
      
      <div className="space-y-3">
        {queueItems.map((queue) => {
          const Icon = queue.icon;
          const status = getQueueStatus(queue.count);
          
          return (
            <div
              key={queue.key}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">{queue.name}</span>
              </div>
              <span className={`text-sm font-semibold ${status.color}`}>
                {queue.count}
              </span>
            </div>
          );
        })}
      </div>

      {total >= 50 && (
        <div className={`mt-4 p-3 rounded-lg ${total >= 100 ? 'bg-red-50' : 'bg-yellow-50'}`}>
          <p className={`text-xs font-medium ${total >= 100 ? 'text-red-700' : 'text-yellow-700'}`}>
            {total >= 100 ? '⚠️ Critical: High queue backlog detected' : '⚠️ Warning: Queue size increasing'}
          </p>
        </div>
      )}
    </div>
  );
}
