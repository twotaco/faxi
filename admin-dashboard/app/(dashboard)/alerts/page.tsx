import { Metadata } from 'next';
import { InfrastructureStatus } from '@/components/health/InfrastructureStatus';
import { ResourceMetrics } from '@/components/health/ResourceMetrics';
import { QueueHealth } from '@/components/health/QueueHealth';
import { RecentErrorsList } from '@/components/health/RecentErrorsList';

export const metadata: Metadata = {
  title: 'System Health - Admin Dashboard',
  description: 'Monitor system health, infrastructure status, and recent errors',
};

async function getHealthData() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  
  try {
    const response = await fetch(`${API_URL}/api/admin/dashboard/health/status`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch health data');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching health data:', error);
    // Return empty data structure on error
    return {
      infrastructure: {
        database: 'down',
        redis: 'down',
        s3: 'down',
      },
      resources: {
        memoryUsage: {
          heapUsed: 0,
          heapTotal: 0,
          percentage: 0,
        },
        uptime: 0,
      },
      queues: {
        faxProcessing: 0,
        emailToFax: 0,
      },
      recentErrors: [],
    };
  }
}

export default async function AlertsPage() {
  const healthData = await getHealthData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
        <p className="mt-2 text-sm text-gray-600">
          Monitor infrastructure status, resource usage, and system errors
        </p>
      </div>

      {/* Infrastructure and Resources Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InfrastructureStatus infrastructure={healthData.infrastructure} />
        <ResourceMetrics resources={healthData.resources} />
      </div>

      {/* Queue Health */}
      <QueueHealth queues={healthData.queues} />

      {/* Recent Errors */}
      <RecentErrorsList errors={healthData.recentErrors} />
    </div>
  );
}
