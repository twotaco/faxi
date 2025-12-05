'use client';

import { useState, Fragment } from 'react';
import { ChevronDown, ChevronRight, User, FileText, Calendar } from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string | null;
  faxJobId: string | null;
  eventType: string;
  eventData: any;
  createdAt: string;
}

interface AuditLogTableProps {
  logs: AuditLog[];
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (logs.length === 0) {
    return (
      <div className="bg-white p-12 rounded-lg shadow text-center">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">No audit logs found</h3>
        <p className="text-sm text-gray-500">
          Try adjusting your filters or check back later
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fax Job ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {logs.map((log) => {
              const isExpanded = expandedRows.has(log.id);
              return (
                <Fragment key={log.id}>
                  <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {log.eventType}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.userId ? (
                        <div className="flex items-center text-sm text-gray-900">
                          <User className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="font-mono text-xs">{log.userId}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.faxJobId ? (
                        <div className="flex items-center text-sm text-gray-900">
                          <FileText className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="font-mono text-xs">{log.faxJobId}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        {formatDate(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleRow(log.id)}
                        className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <ChevronRight className="w-4 h-4 mr-1" />
                            Show
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700">Event Data</h4>
                          <pre className="bg-white p-4 rounded-lg border border-gray-200 overflow-x-auto text-xs font-mono max-h-96 overflow-y-auto">
                            {JSON.stringify(log.eventData, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
