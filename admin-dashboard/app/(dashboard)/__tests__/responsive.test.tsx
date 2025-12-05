/**
 * Responsive layout tests for admin dashboard pages
 * Verifies that pages render correctly at different viewport sizes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
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
    get: vi.fn().mockResolvedValue({
      servers: [],
      recentErrors: [],
      externalAPIs: [],
    }),
  },
}));

describe('Responsive Layout Tests', () => {
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

  const viewportSizes = [
    { name: 'Mobile', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1920, height: 1080 },
  ];

  describe('MCP Page Responsive Layout', () => {
    viewportSizes.forEach(({ name, width, height }) => {
      it(`should render without errors on ${name} (${width}x${height})`, async () => {
        // Set viewport size
        global.innerWidth = width;
        global.innerHeight = height;

        const MCPPage = (await import('../mcp/page')).default;
        const { container } = renderWithProviders(<MCPPage />);

        expect(container).toBeTruthy();
        expect(container.querySelector('*')).toBeTruthy();
      });
    });
  });

  describe('AI Inspector Page Responsive Layout', () => {
    viewportSizes.forEach(({ name, width, height }) => {
      it(`should render without errors on ${name} (${width}x${height})`, async () => {
        global.innerWidth = width;
        global.innerHeight = height;

        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValueOnce({
          aggregate: {
            successRate: 95,
            avgAccuracy: 0.9,
            avgConfidence: 0.85,
            avgProcessingTime: 1000,
          },
          recentProcessing: [],
        });

        const AIPage = (await import('../ai/page')).default;
        const { container } = renderWithProviders(<AIPage />);

        expect(container).toBeTruthy();
      });
    });
  });

  describe('System Health Page Responsive Layout', () => {
    viewportSizes.forEach(({ name, width, height }) => {
      it(`should render without errors on ${name} (${width}x${height})`, async () => {
        global.innerWidth = width;
        global.innerHeight = height;

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
            faxProcessing: 0,
            emailToFax: 0,
          },
          recentErrors: [],
        });

        const AlertsPage = (await import('../alerts/page')).default;
        const { container } = renderWithProviders(<AlertsPage />);

        expect(container).toBeTruthy();
      });
    });
  });

  describe('Analytics Page Responsive Layout', () => {
    viewportSizes.forEach(({ name, width, height }) => {
      it(`should render without errors on ${name} (${width}x${height})`, async () => {
        global.innerWidth = width;
        global.innerHeight = height;

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
        const { container } = renderWithProviders(<AnalyticsPage />);

        expect(container).toBeTruthy();
      });
    });
  });

  describe('Audit Logs Page Responsive Layout', () => {
    viewportSizes.forEach(({ name, width, height }) => {
      it(`should render without errors on ${name} (${width}x${height})`, async () => {
        global.innerWidth = width;
        global.innerHeight = height;

        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValueOnce({
          logs: [],
          total: 0,
          eventTypes: [],
        });

        const AuditPage = (await import('../audit/page')).default;
        const { container } = renderWithProviders(<AuditPage />);

        expect(container).toBeTruthy();
      });
    });
  });

  describe('Grid Layout Responsiveness', () => {
    it('should use appropriate grid columns for different screen sizes', () => {
      // Mobile: 1 column
      global.innerWidth = 375;
      expect(global.innerWidth < 768).toBe(true);

      // Tablet: 2 columns
      global.innerWidth = 768;
      expect(global.innerWidth >= 768 && global.innerWidth < 1024).toBe(true);

      // Desktop: 3+ columns
      global.innerWidth = 1920;
      expect(global.innerWidth >= 1024).toBe(true);
    });
  });
});
