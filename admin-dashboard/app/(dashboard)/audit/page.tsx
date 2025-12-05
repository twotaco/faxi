'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { AuditLogTable } from '@/components/audit/AuditLogTable';
import { EventTypeFilter } from '@/components/audit/EventTypeFilter';
import { DateRangeFilter } from '@/components/audit/DateRangeFilter';
import { RefreshCw, FileText } from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string | null;
  faxJobId: string | null;
  eventType: string;
  eventData: any;
  createdAt: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  eventTypes: string[];
}

async function fetchAuditLogs(
  eventType?: string,
  startDate?: string,
  endDate?: string
): Promise<AuditLogsResponse> {
  const params = new URLSearchParams();
  if (eventType) params.append('eventType', eventType);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  params.append('limit', '100');

  const response = await apiClient.get(`/api/admin/dashboard/audit/logs?${params.toString()}`);
  return response.data;
}

export default function AuditLogsPage() {
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs', selectedEventType, startDate, endDate],
    queryFn: () => fetchAuditLogs(
      selectedEventType || undefined,
      startDate || undefined,
      endDate || undefined
    ),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleEventTypeChange = (eventType: string) => {
    setSelectedEventType(eventType);
  };

  const handleDateRangeChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleClearFilters = () => {
    setSelectedEventType('');
    setStartDate('');
    setEndDate('');
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Failed to load audit logs</h3>
        <p className="text-red-600 text-sm mb-4">
          {error instanceof Error ? error.message : 'An error occurred'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-800">Audit Logs</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Search and filter system audit logs for compliance and debugging
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <EventTypeFilter
            eventTypes={data?.eventTypes || []}
            selectedEventType={selectedEventType}
            onEventTypeChange={handleEventTypeChange}
          />
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={handleDateRangeChange}
          />
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
        {(selectedEventType || startDate || endDate) && (
          <div className="mt-4 text-sm text-gray-600">
            Showing {data?.total || 0} results
            {selectedEventType && ` for event type "${selectedEventType}"`}
            {startDate && ` from ${new Date(startDate).toLocaleDateString()}`}
            {endDate && ` to ${new Date(endDate).toLocaleDateString()}`}
          </div>
        )}
      </div>

      {/* Audit Logs Table */}
      {isLoading && !data ? (
        <div className="bg-white p-6 rounded-lg shadow animate-pulse">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      ) : (
        <AuditLogTable logs={data?.logs || []} />
      )}
    </div>
  );
}
