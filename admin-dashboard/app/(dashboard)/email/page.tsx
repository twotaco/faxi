'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { RefreshCw, Mail, ArrowUpRight, ArrowDownRight, AlertTriangle, CheckCircle, XCircle, Clock, FileText, Phone, ArrowRight, Loader2, Search, X, ChevronDown, ChevronUp, User } from 'lucide-react';
import React, { useState, useEffect } from 'react';

interface PipelineJob {
  id: string;
  faxId: string;
  userId: string;
  toNumber: string;
  status: string;
  emailFrom: string;
  emailSubject: string;
  emailReceivedAt: string;
  telnyxFaxId: string | null;
  pageCount: number | null;
  referenceId: string | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  processingDuration: number | null;
}

interface EmailMetricsData {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  metrics: {
    totalSent: number;
    totalDelivered: number;
    totalBounced: number;
    totalComplaints: number;
    bounceRate: number;
    complaintRate: number;
    deliveryRate: number;
  };
  inbound: {
    totalReceived: number;
    rejectedUnregistered: number;
    rejectedBlocked: number;
  };
  pipeline: {
    stats: {
      total: number;
      completed: number;
      processing: number;
      pending: number;
      failed: number;
    };
    jobs: PipelineJob[];
  };
  alerts: Array<{
    type: string;
    severity: 'warning' | 'critical';
    message: string;
    threshold: number;
    actual: number;
  }>;
  dailyMetrics: Array<{
    date: string;
    sent: number;
    delivered: number;
    bounced: number;
    complaints: number;
    bounceRate: number;
    deliveryRate: number;
  }>;
  recentEvents: Array<{
    id: string;
    userId: string;
    eventType: string;
    provider: string;
    status: string;
    fromDomain: string;
    toDomain: string;
    senderEmail: string | null;
    recipientEmail: string | null;
    phoneNumber: string | null;
    subject: string | null;
    createdAt: string;
    eventData: Record<string, unknown> | null;
  }>;
}

type EmailEvent = EmailMetricsData['recentEvents'][number];

async function fetchEmailMetrics(days: number, userId?: string): Promise<EmailMetricsData> {
  const params = new URLSearchParams({ days: String(days) });
  if (userId) params.append('userId', userId);
  const response = await apiClient.get(`/api/admin/dashboard/email/metrics?${params}`);
  return response.data;
}

function formatEventType(eventType: string): string {
  return eventType.replace('email.', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getEventIcon(eventType: string) {
  if (eventType.includes('delivered') || eventType.includes('received')) {
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  }
  if (eventType.includes('bounced') || eventType.includes('failed')) {
    return <XCircle className="w-4 h-4 text-red-500" />;
  }
  if (eventType.includes('rejected')) {
    return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  }
  return <Clock className="w-4 h-4 text-blue-500" />;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Delivered</span>;
    case 'processing':
      return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Processing</span>;
    case 'pending':
      return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
    case 'failed':
      return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Failed</span>;
    default:
      return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">{status}</span>;
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function maskPhoneNumber(phone: string): string {
  if (!phone) return '-';
  // Show last 4 digits only
  return phone.replace(/(.*)(\d{4})$/, '***$2');
}

function extractDomain(email: string): string {
  if (!email) return '-';
  const match = email.match(/@([^@]+)$/);
  return match ? match[1] : email;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function EmailMetricsPage() {
  const [days, setDays] = useState(7);
  const [selectedJob, setSelectedJob] = useState<PipelineJob | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EmailEvent | null>(null);
  const [userIdFilter, setUserIdFilter] = useState('');
  const [debouncedUserId, setDebouncedUserId] = useState('');

  // Debounce user ID filter
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserId(userIdFilter);
    }, 500);
    return () => clearTimeout(timer);
  }, [userIdFilter]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['email-metrics', days, debouncedUserId],
    queryFn: () => fetchEmailMetrics(days, debouncedUserId || undefined),
    refetchInterval: 60000,
  });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Failed to load email metrics</h3>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <Mail className="w-8 h-8 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-800">Email Metrics</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Email delivery rates, bounce tracking, and email-to-fax pipeline
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg flex items-center space-x-3 ${
                alert.severity === 'critical'
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 ${
                  alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                }`}
              />
              <span
                className={
                  alert.severity === 'critical' ? 'text-red-700' : 'text-yellow-700'
                }
              >
                {alert.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {isLoading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Email-to-Fax Pipeline */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Email-to-Fax Pipeline (Inbound)</h3>

            {/* Pipeline Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <p className="text-2xl font-bold text-gray-800">{data?.pipeline?.stats?.total || 0}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <p className="text-2xl font-bold text-green-600">{data?.pipeline?.stats?.completed || 0}</p>
                <p className="text-xs text-gray-500">Delivered</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <p className="text-2xl font-bold text-blue-600">{data?.pipeline?.stats?.processing || 0}</p>
                <p className="text-xs text-gray-500">Processing</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <p className="text-2xl font-bold text-yellow-600">{data?.pipeline?.stats?.pending || 0}</p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow text-center">
                <p className="text-2xl font-bold text-red-600">{data?.pipeline?.stats?.failed || 0}</p>
                <p className="text-xs text-gray-500">Failed</p>
              </div>
            </div>

            {/* Pipeline Jobs Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {data?.pipeline?.jobs && data.pipeline.jobs.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flow</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To (Fax)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pages</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.pipeline.jobs.map((job) => (
                      <tr
                        key={job.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1 text-xs">
                            <Mail className="w-4 h-4 text-blue-500" />
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <FileText className="w-4 h-4 text-purple-500" />
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <Phone className="w-4 h-4 text-green-500" />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {extractDomain(job.emailFrom)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                          {maskPhoneNumber(job.toNumber)}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(job.status)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {job.pageCount || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDuration(job.processingDuration)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {timeAgo(job.emailReceivedAt || job.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No email-to-fax jobs in this period</p>
                </div>
              )}
            </div>

            {/* Selected Job Detail */}
            {selectedJob && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-3">Pipeline Details</h4>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  {/* Step 1: Email Received */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                      <Mail className="w-6 h-6 text-blue-600" />
                    </div>
                    <span className="text-xs font-medium text-blue-800">Email Received</span>
                    <span className="text-xs text-blue-600">{extractDomain(selectedJob.emailFrom)}</span>
                    <span className="text-xs text-gray-500">
                      {selectedJob.emailReceivedAt ? new Date(selectedJob.emailReceivedAt).toLocaleString() : '-'}
                    </span>
                  </div>

                  <ArrowRight className="w-6 h-6 text-blue-400" />

                  {/* Step 2: Fax Job Created */}
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                      selectedJob.status !== 'pending' ? 'bg-purple-100' : 'bg-gray-100'
                    }`}>
                      <FileText className={`w-6 h-6 ${
                        selectedJob.status !== 'pending' ? 'text-purple-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <span className="text-xs font-medium text-purple-800">Fax Created</span>
                    <span className="text-xs text-purple-600">#{selectedJob.faxId}</span>
                    <span className="text-xs text-gray-500">
                      {selectedJob.pageCount ? `${selectedJob.pageCount} pages` : 'Processing...'}
                    </span>
                  </div>

                  <ArrowRight className="w-6 h-6 text-blue-400" />

                  {/* Step 3: Fax Sent */}
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                      selectedJob.telnyxFaxId ? 'bg-orange-100' : 'bg-gray-100'
                    }`}>
                      <Phone className={`w-6 h-6 ${
                        selectedJob.telnyxFaxId ? 'text-orange-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <span className="text-xs font-medium text-orange-800">Fax Sent</span>
                    <span className="text-xs text-orange-600 font-mono">{maskPhoneNumber(selectedJob.toNumber)}</span>
                    <span className="text-xs text-gray-500">
                      {selectedJob.telnyxFaxId || 'Waiting...'}
                    </span>
                  </div>

                  <ArrowRight className="w-6 h-6 text-blue-400" />

                  {/* Step 4: Delivery Status */}
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                      selectedJob.status === 'completed' ? 'bg-green-100' :
                      selectedJob.status === 'failed' ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                      {selectedJob.status === 'completed' ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : selectedJob.status === 'failed' ? (
                        <XCircle className="w-6 h-6 text-red-600" />
                      ) : (
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${
                      selectedJob.status === 'completed' ? 'text-green-800' :
                      selectedJob.status === 'failed' ? 'text-red-800' : 'text-gray-800'
                    }`}>
                      {selectedJob.status === 'completed' ? 'Delivered' :
                       selectedJob.status === 'failed' ? 'Failed' : 'In Progress'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString() : '-'}
                    </span>
                    {selectedJob.processingDuration && (
                      <span className="text-xs text-gray-500">
                        Total: {formatDuration(selectedJob.processingDuration)}
                      </span>
                    )}
                  </div>
                </div>
                {selectedJob.errorMessage && (
                  <div className="mt-3 p-2 bg-red-100 rounded text-sm text-red-700">
                    Error: {selectedJob.errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Outbound Email Stats */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Outbound Email</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Sent</span>
                  <ArrowUpRight className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-gray-800 mt-2">
                  {data?.metrics.totalSent.toLocaleString() || 0}
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Delivery Rate</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-gray-800 mt-2">
                  {data?.metrics.deliveryRate || 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {data?.metrics.totalDelivered.toLocaleString() || 0} delivered
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Bounce Rate</span>
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <p className={`text-2xl font-bold mt-2 ${
                  (data?.metrics.bounceRate || 0) > 5 ? 'text-red-600' : 'text-gray-800'
                }`}>
                  {data?.metrics.bounceRate || 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {data?.metrics.totalBounced.toLocaleString() || 0} bounced
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Complaint Rate</span>
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                </div>
                <p className={`text-2xl font-bold mt-2 ${
                  (data?.metrics.complaintRate || 0) > 0.1 ? 'text-yellow-600' : 'text-gray-800'
                }`}>
                  {data?.metrics.complaintRate || 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {data?.metrics.totalComplaints.toLocaleString() || 0} complaints
                </p>
              </div>
            </div>
          </div>

          {/* Inbound Email Stats */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Inbound Email (Raw)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Emails Received</span>
                  <ArrowDownRight className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-gray-800 mt-2">
                  {data?.inbound.totalReceived.toLocaleString() || 0}
                </p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Rejected (Unregistered)</span>
                  <XCircle className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold text-gray-800 mt-2">
                  {data?.inbound.rejectedUnregistered.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Unknown recipients</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Rejected (Blocked)</span>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-2xl font-bold text-gray-800 mt-2">
                  {data?.inbound.rejectedBlocked.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">Blocked senders</p>
              </div>
            </div>
          </div>

          {/* Recent Events */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Recent Email Events</h3>
              {/* User ID Filter */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={userIdFilter}
                    onChange={(e) => setUserIdFilter(e.target.value)}
                    placeholder="Filter by User ID..."
                    className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {userIdFilter && (
                    <button
                      onClick={() => setUserIdFilter('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {debouncedUserId && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    Filtered
                  </span>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {data?.recentEvents && data.recentEvents.length > 0 ? (
                <>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Event
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          From
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          To
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subject
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.recentEvents.map((event) => (
                        <React.Fragment key={event.id}>
                          <tr
                            onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              {selectedEvent?.id === event.id ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                {getEventIcon(event.eventType)}
                                <span className="text-sm text-gray-900">
                                  {formatEventType(event.eventType)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {event.senderEmail || event.fromDomain || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {event.recipientEmail || event.toDomain || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={event.subject || ''}>
                              {event.subject || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(event.createdAt).toLocaleString()}
                            </td>
                          </tr>
                          {/* Inline Detail Row */}
                          {selectedEvent?.id === event.id && (
                            <tr>
                              <td colSpan={6} className="px-0 py-0">
                                <div className="bg-blue-50 p-4 border-t border-b border-blue-100">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                      <p className="text-xs text-blue-700 font-medium">Event ID</p>
                                      <p className="text-sm text-blue-900 font-mono">{event.id.slice(0, 8)}...</p>
                                    </div>
                                    {event.userId && (
                                      <div>
                                        <p className="text-xs text-blue-700 font-medium">User ID</p>
                                        <p className="text-sm text-blue-900 font-mono">{event.userId.slice(0, 8)}...</p>
                                      </div>
                                    )}
                                    {event.phoneNumber && (
                                      <div>
                                        <p className="text-xs text-blue-700 font-medium">Phone Number</p>
                                        <p className="text-sm text-blue-900">{event.phoneNumber}</p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-xs text-blue-700 font-medium">Timestamp</p>
                                      <p className="text-sm text-blue-900">{new Date(event.createdAt).toLocaleString()}</p>
                                    </div>
                                  </div>

                                  {/* Full Event Data */}
                                  {event.eventData && (
                                    <details className="mt-3">
                                      <summary className="cursor-pointer text-sm font-medium text-blue-800 hover:text-blue-900">
                                        View Full Event Data (JSON)
                                      </summary>
                                      <pre className="mt-2 p-3 bg-white rounded-lg border border-blue-200 text-xs overflow-x-auto max-h-48 overflow-y-auto">
                                        {JSON.stringify(event.eventData, null, 2)}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{debouncedUserId ? 'No email events for this user' : 'No recent email events'}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
