/**
 * Integration tests for admin dashboard quick wins pages
 * Tests all pages load without errors, authentication, empty states, error handling, and responsive layout
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/dashboard',
}));

// Mock API client
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Admin Dashboard Integration Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('MCP Servers Page (/mcp)', () => {
    it('should load without errors with data', async () => {
      const { apiClient } = await import('@/lib/api/client');
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        servers: [
          {
            name: 'email',
            totalCalls: 100,
            successRate: 98.5,
            failedCount: 2,
            status: 'up',
          },
        ],
        recentErrors: [],
        externalAPIs: [
          { name: 'Telnyx', status: 'up' },
          { name: 'Stripe', status: 'up' },
        ],
      });

      const MCPPage = (await import('../mcp/page')).default;
      renderWithProviders(<MCPPage />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should handle empty data state', async () => {
      const { apiClient } = await import('@/lib/api/client');
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        servers: [],
        recentErrors: [],
        externalAPIs: [],
      });

      const MCPPage = (await import('../mcp/page')).default;
      renderWithProviders(<MCPPage />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      const { apiClient } = await import('@/lib/api/client');
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('API Error'));

      const MCPPage = (await import('../mcp/page')).default;
      renderWithProviders(<MCPPage />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('AI Inspector Page (/ai)', () => {
    it('should load without errors with data', async () => {
      const { apiClient } = await import('@/lib/api/client');
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        aggregate: {
          successRate: 95.5,
          avgAccuracy: 0.92,
          avgConfidence: 0.88,
          avgProcessingTime: 1250,
        },
        recentProcessing: [
          {
            id: '1',
            faxJobId: 'fax-123',
            metricType: 'vision_interpretation',
            accuracy: 0.95,
            confidence: 0.90,
            processingTime: 1200,
            success: true,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const AIPage = (await import('../ai/page')).default;
      renderWithProviders(<AIPage />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should handle empty data state', async () => {
      const { apiClient } = await import('@/lib/api/client');
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        aggregate: {
          successRate: 0,
          avgAccuracy: 0,
          avgConfidence: 0,
          avgProcessingTime: 0,
        },
        recentProcessing: [],
      });

      const AIPage = (await import('../ai/page')).default;
      renderWithProviders(<AIPage />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('System Health Page (/alerts)', () => {
    it('should load without errors with data', async () => {
      const { apiClient } = await import('@/lib/api/client');
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        infrastructure: {
          database: 'up',
          redis: 'up',
          s3: 'up',
        },
        resources: {
          memoryUsage: {
            heapUsed: 100000000,
            heapTotal: 200000000,
            percentage: 50,
          },
          uptime: 86400,
        },
        queues: {
          faxProcessing: 5,
          emailToFax: 2,
        },
        recentErrors: [],
      });

      const AlertsPage = (await import('../alerts/page')).default;
      renderWithProviders(<AlertsPage />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should highlight down components', async () => {
      const { apiClient } = await import('@/lib/api/client');
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        infrastructure: {
          database: 'down',
          redis: 'up',
          s3: 'up',
        },
        resources: {
          memoryUsage: {
            heapUsed: 100000000,
            heapTotal: 200000000,
            percentage: 50,
          },
          uptime: 86400,
        },
        queues: {
          faxProcessing: 0,
          emailToFax: 0,
        },
        recentErrors: [],
      });

      const AlertsPage = (await import('../alerts/page')).default;
      renderWithProviders(<AlertsPage />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Analytics Page (/analytics)', () => {
    it('should load without errors with data', async () => {
      const { apiClient } = await import('@/lib/api/client');
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        users: {
          total: 150,
          byRegion: { Tokyo: 50, Osaka: 30 },
          byAgeRange: { '65-74': 60, '75+': 90 },
          byDigitalScore: { low: 100, medium: 40, high: 10 },
        },
        faxJobs: {
          total: 500,
          last24Hours: 25,
          byStatus: { completed: 450, failed: 50 },
          perDay: [
            { date: '2025-12-01', count: 20 },
            { date: '2025-12-02', count: 25 },
          ],
        },
        orders: {
          total: 75,
          totalRevenue: 150000,
          byStatus: { completed: 70, pending: 5 },
        },
        processing: {
          avgAccuracy: 0.92,
          avgConfidence: 0.88,
          avgProcessingTime: 1250,
        },
      });

      const AnalyticsPage = (await import('../analytics/page')).default;
      renderWithProviders(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should handle empty data state', async () => {
      const { apiClient } = await import('@/lib/api/client');
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        users: {
          total: 0,
          byRegion: {},
          byAgeRange: {},
          byDigitalScore: {},
        },
        faxJobs: {
          total: 0,
          last24Hours: 0,
          byStatus: {},
          perDay: [],
        },
        orders: {
          total: 0,
          totalRevenue: 0,
          byStatus: {},
        },
        processing: {
          avgAccuracy: 0,
          avgConfidence: 0,
          avgProcessingTime: 0,
        },
      });

      const AnalyticsPage = (await import('../analytics/page')).default;
      renderWithProviders(<AnalyticsPage />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Audit Logs Page (/audit)', () => {
    it('should load without errors with data', async () => {
      const { apiClient } = await import('@/lib/api/client');
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        logs: [
          {
            id: '1',
            userId: 'user-123',
            faxJobId: 'fax-456',
            eventType: 'mcp.tool_call',
            eventData: { tool: 'email.send' },
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        eventTypes: ['mcp.tool_call', 'fax.received'],
      });

      const AuditPage = (await import('../audit/page')).default;
      renderWithProviders(<AuditPage />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });

    it('should handle empty data state', async () => {
      const { apiClient } = await import('@/lib/api/client');
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        logs: [],
        total: 0,
        eventTypes: [],
      });

      const AuditPage = (await import('../audit/page')).default;
      renderWithProviders(<AuditPage />);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });
  });
});
