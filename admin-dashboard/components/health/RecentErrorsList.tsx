'use client';

import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorLog {
  id: number;
  level: string;
  message: string;
  context: any;
  createdAt: string;
}

interface RecentErrorsListProps {
  errors: ErrorLog[];
}

export function RecentErrorsList({ errors }: RecentErrorsListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (errors.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Errors</h3>
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No recent errors - system running smoothly!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Errors</h3>
        <span className="text-sm text-gray-500">Last 50 errors</span>
      </div>
      
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {errors.map((error) => (
          <div
            key={error.id}
            className="border border-red-200 rounded-lg bg-red-50 overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(error.id)}
              className="w-full p-4 text-left hover:bg-red-100 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-xs font-medium text-red-700 uppercase">
                      {error.level}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(error.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 font-medium truncate">
                    {error.message}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {expandedId === error.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </div>
            </button>

            {expandedId === error.id && error.context && (
              <div className="px-4 pb-4 border-t border-red-200">
                <div className="mt-3 bg-white rounded p-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Context:</p>
                  <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(error.context, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
