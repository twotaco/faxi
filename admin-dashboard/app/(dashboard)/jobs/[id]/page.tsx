'use client';

import { useJob, useRetryJob, useCancelJob } from '@/lib/hooks/useJobs';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, XCircle, Download, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const { data, isLoading, error } = useJob(id);
  const retryMutation = useRetryJob();
  const cancelMutation = useCancelJob();
  
  const [showRetryConfirm, setShowRetryConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const job = data?.job;
  const auditLogs = data?.auditLogs || [];

  const handleRetry = async () => {
    try {
      await retryMutation.mutateAsync(id);
      setShowRetryConfirm(false);
      alert('Job retry initiated successfully');
    } catch (err: any) {
      alert(`Failed to retry job: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(id);
      setShowCancelConfirm(false);
      alert('Job cancelled successfully');
    } catch (err: any) {
      alert(`Failed to cancel job: ${err.response?.data?.message || err.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-faxi-orange mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Failed to load job details</h3>
        <p className="text-red-600 text-sm mb-4">
          {error instanceof Error ? error.message : 'Job not found'}
        </p>
        <Link
          href="/jobs"
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jobs
        </Link>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      case 'processing':
        return <Clock className="w-6 h-6 text-yellow-600 animate-spin" />;
      default:
        return <Clock className="w-6 h-6 text-gray-600" />;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link
            href="/jobs"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Job Details</h2>
            <p className="text-sm text-gray-600 font-mono mt-1">
              {job.referenceId || job.id}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          {job.status === 'failed' && (
            <button
              onClick={() => setShowRetryConfirm(true)}
              disabled={retryMutation.isPending}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          )}
          
          {['pending', 'processing'].includes(job.status) && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={cancelMutation.isPending}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Job Overview */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center space-x-3 mb-6">
          {getStatusIcon(job.status)}
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Status: <span className="capitalize">{job.status}</span>
            </h3>
            {job.errorMessage && (
              <p className="text-sm text-red-600 mt-1">{job.errorMessage}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-3">Basic Information</h4>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Direction:</dt>
                <dd className="text-sm font-medium text-gray-900 capitalize">{job.direction}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">From:</dt>
                <dd className="text-sm font-medium text-gray-900">{job.fromNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">To:</dt>
                <dd className="text-sm font-medium text-gray-900">{job.toNumber}</dd>
              </div>
              {job.pageCount && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Pages:</dt>
                  <dd className="text-sm font-medium text-gray-900">{job.pageCount}</dd>
                </div>
              )}
            </dl>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-3">Timestamps</h4>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Created:</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {new Date(job.createdAt).toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Updated:</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {new Date(job.updatedAt).toLocaleString()}
                </dd>
              </div>
              {job.completedAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Completed:</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {new Date(job.completedAt).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Interpretation Result */}
      {job.interpretationResult && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">AI Interpretation</h3>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm">
            {JSON.stringify(job.interpretationResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Audit Logs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Activity History</h3>
        {auditLogs.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No activity logs</p>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">{log.eventType}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {log.eventData && (
                    <pre className="text-xs text-gray-600 mt-1 overflow-x-auto">
                      {JSON.stringify(log.eventData, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modals */}
      {showRetryConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Retry Job?</h3>
            <p className="text-gray-600 mb-6">
              This will re-queue the job for processing. Are you sure?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleRetry}
                disabled={retryMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {retryMutation.isPending ? 'Retrying...' : 'Yes, Retry'}
              </button>
              <button
                onClick={() => setShowRetryConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Cancel Job?</h3>
            <p className="text-gray-600 mb-6">
              This will mark the job as failed and stop processing. Are you sure?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Yes, Cancel Job'}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Keep Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
