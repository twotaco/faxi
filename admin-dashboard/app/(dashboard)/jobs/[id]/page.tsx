'use client';

import { useJob, useRetryJob, useCancelJob } from '@/lib/hooks/useJobs';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, XCircle, Download, Clock, CheckCircle, AlertCircle, FileImage, Eye } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function JobDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, isLoading, error } = useJob(id);
  const retryMutation = useRetryJob();
  const cancelMutation = useCancelJob();

  const [showRetryConfirm, setShowRetryConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showInboundFax, setShowInboundFax] = useState(false);
  const [showResponseFax, setShowResponseFax] = useState(false);
  const [agentResponse, setAgentResponse] = useState<any>(null);
  const [loadingAgentResponse, setLoadingAgentResponse] = useState(false);
  const [inboundFaxUrl, setInboundFaxUrl] = useState<string | null>(null);
  const [responseFaxUrl, setResponseFaxUrl] = useState<string | null>(null);
  const [loadingInboundFax, setLoadingInboundFax] = useState(false);
  const [loadingResponseFax, setLoadingResponseFax] = useState(false);

  const job = data?.job;
  const auditLogs = data?.auditLogs || [];

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const loadFaxImage = async (type: 'inbound' | 'response') => {
    try {
      if (type === 'inbound') {
        setLoadingInboundFax(true);
      } else {
        setLoadingResponseFax(true);
      }

      const token = localStorage.getItem('admin_access_token');
      console.log(`Loading ${type} fax image for job ${id}`);
      const response = await fetch(`${apiUrl}/admin/jobs/${id}/fax-image?type=${type}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log(`Response status for ${type} fax:`, response.status);

      if (response.ok) {
        const blob = await response.blob();
        console.log(`Blob size for ${type} fax:`, blob.size);
        const url = URL.createObjectURL(blob);
        if (type === 'inbound') {
          setInboundFaxUrl(url);
        } else {
          setResponseFaxUrl(url);
        }
      } else {
        const errorText = await response.text();
        console.error(`Failed to load ${type} fax image:`, response.status, errorText);
      }
    } catch (error) {
      console.error(`Failed to load ${type} fax image:`, error);
    } finally {
      if (type === 'inbound') {
        setLoadingInboundFax(false);
      } else {
        setLoadingResponseFax(false);
      }
    }
  };

  const downloadFaxPdf = async (type: 'inbound' | 'response') => {
    try {
      const token = localStorage.getItem('admin_access_token');
      console.log(`Downloading ${type} fax PDF for job ${id}`);
      const response = await fetch(`${apiUrl}/admin/jobs/${id}/fax-download?type=${type}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${type === 'response' ? job?.actionResults?.responseFaxId : job?.faxId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const errorText = await response.text();
        console.error(`Failed to download ${type} fax PDF:`, response.status, errorText);
        alert(`Failed to download ${type} fax PDF`);
      }
    } catch (error) {
      console.error(`Failed to download ${type} fax PDF:`, error);
      alert(`Failed to download ${type} fax PDF`);
    }
  };

  // Auto-load fax images when job data is available
  useEffect(() => {
    if (job && !inboundFaxUrl) {
      loadFaxImage('inbound');
    }
    if (job?.actionResults?.responseFaxId && !responseFaxUrl) {
      loadFaxImage('response');
    }
  }, [job?.id, job?.actionResults?.responseFaxId]);

  const loadAgentResponse = async () => {
    if (agentResponse) return; // Already loaded
    
    setLoadingAgentResponse(true);
    try {
      const token = localStorage.getItem('admin_access_token');
      console.log('Loading agent response for job:', id);
      const response = await fetch(`${apiUrl}/admin/jobs/${id}/agent-response`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      console.log('Agent response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Agent response data:', data);
        setAgentResponse(data.agentResponse);
      } else {
        const errorText = await response.text();
        console.error('Failed to load agent response:', response.status, errorText);
        alert(`Failed to load agent response: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to load agent response:', error);
      alert(`Error loading agent response: ${error}`);
    } finally {
      setLoadingAgentResponse(false);
    }
  };

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
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center space-x-3 mb-4">
          {getStatusIcon(job.status)}
          <div>
            <h3 className="text-base font-semibold text-gray-800">
              Status: <span className="capitalize">{job.status}</span>
            </h3>
            {job.errorMessage && (
              <p className="text-sm text-red-600 mt-1">{job.errorMessage}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="text-base font-semibold text-gray-800 mb-3">AI Interpretation</h3>
          <pre className="bg-gray-50 p-3 rounded-lg overflow-x-auto text-xs max-h-60 overflow-y-auto">
            {JSON.stringify(job.interpretationResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Action Results */}
      {job.actionResults && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="text-base font-semibold text-gray-800 mb-3">Action Results</h3>
          <div className="space-y-2">
            {job.actionResults.responseReferenceId && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">Response Reference ID:</span>
                  <p className="text-sm font-mono text-green-700 mt-1">{job.actionResults.responseReferenceId}</p>
                </div>
              </div>
            )}
            {job.actionResults.responseFaxId && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700">Response Fax ID:</span>
                  <p className="text-sm font-mono text-blue-700 mt-1">{job.actionResults.responseFaxId}</p>
                </div>
              </div>
            )}
            {/* Show full JSON for debugging */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                View Raw JSON
              </summary>
              <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm mt-2">
                {JSON.stringify(job.actionResults, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}

      {/* Fax Images */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Fax Images</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Inbound Fax */}
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Inbound Fax</h4>
              {inboundFaxUrl && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => downloadFaxPdf('inbound')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={() => setShowInboundFax(true)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Full Size</span>
                  </button>
                </div>
              )}
            </div>
            <div className="bg-gray-100 rounded w-full max-h-[400px] flex items-center justify-center overflow-hidden">
              {loadingInboundFax ? (
                <div className="py-20">
                  <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : inboundFaxUrl ? (
                <img
                  src={inboundFaxUrl}
                  alt="Inbound Fax"
                  className="w-full h-auto max-h-[400px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setShowInboundFax(true)}
                />
              ) : (
                <div className="py-20">
                  <FileImage className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Response Fax */}
          {job.actionResults?.responseFaxId && (
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Response Fax</h4>
                {responseFaxUrl && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => downloadFaxPdf('response')}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={() => setShowResponseFax(true)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Full Size</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="bg-gray-100 rounded w-full max-h-[400px] flex items-center justify-center overflow-hidden">
                {loadingResponseFax ? (
                  <div className="py-20">
                    <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : responseFaxUrl ? (
                  <img
                    src={responseFaxUrl}
                    alt="Response Fax"
                    className="w-full h-auto max-h-[400px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setShowResponseFax(true)}
                  />
                ) : (
                  <div className="py-20">
                    <FileImage className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LLM Output / Agent Response */}
      {job.status === 'completed' && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-800">LLM Output (Agent Response)</h3>
            {!agentResponse && (
              <button
                onClick={loadAgentResponse}
                disabled={loadingAgentResponse}
                className="flex items-center space-x-2 px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {loadingAgentResponse ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Load Response</span>
                  </>
                )}
              </button>
            )}
          </div>
          
          {agentResponse ? (
            <div className="space-y-2">
              {agentResponse.responseReferenceId && (
                <div className="p-2 bg-purple-50 rounded-lg">
                  <span className="text-xs font-medium text-gray-700">Reference ID:</span>
                  <p className="text-xs font-mono text-purple-700 mt-1">{agentResponse.responseReferenceId}</p>
                </div>
              )}

              <details>
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 mb-2">
                  Full Agent Response
                </summary>
                <pre className="bg-gray-50 p-3 rounded-lg overflow-x-auto text-xs max-h-60 overflow-y-auto">
                  {JSON.stringify(agentResponse, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-3">
              Click "Load Response" to view the LLM output
            </p>
          )}
        </div>
      )}

      {/* Audit Logs */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Activity History</h3>
        {auditLogs.length === 0 ? (
          <p className="text-gray-500 text-center py-3 text-sm">No activity logs</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-800">{log.eventType}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                {log.eventData && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-800">
                      View Details
                    </summary>
                    <pre className="text-xs text-gray-600 mt-1 overflow-x-auto bg-white p-2 rounded">
                      {JSON.stringify(log.eventData, null, 2)}
                    </pre>
                  </details>
                )}
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

      {/* Inbound Fax Image Modal */}
      {showInboundFax && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Inbound Fax Image</h3>
              <button
                onClick={() => setShowInboundFax(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex justify-center">
              {inboundFaxUrl ? (
                <img
                  src={inboundFaxUrl}
                  alt="Inbound Fax"
                  className="max-w-full max-h-[70vh] w-auto h-auto border border-gray-300 rounded object-contain"
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Response Fax Image Modal */}
      {showResponseFax && job.actionResults?.responseFaxId && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Response Fax Image</h3>
              <button
                onClick={() => setShowResponseFax(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex justify-center">
              {responseFaxUrl ? (
                <img
                  src={responseFaxUrl}
                  alt="Response Fax"
                  className="max-w-full max-h-[70vh] w-auto h-auto border border-gray-300 rounded object-contain"
                />
              ) : (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
