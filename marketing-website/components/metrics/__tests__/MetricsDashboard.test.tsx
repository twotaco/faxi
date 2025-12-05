import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricsDashboard } from '../MetricsDashboard';
import * as useMetricsHook from '@/lib/hooks/useMetrics';

vi.mock('@/lib/hooks/useMetrics');

describe('MetricsDashboard', () => {
  const mockUseMetrics = vi.mocked(useMetricsHook.useMetrics);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading state when fetching metrics', () => {
    mockUseMetrics.mockReturnValue({
      accuracyMetrics: null,
      processingStats: null,
      isLoading: true,
      error: null,
      lastUpdated: null,
      refresh: vi.fn(),
    });

    render(<MetricsDashboard />);
    expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
  });

  it('displays error state when metrics fail to load', () => {
    mockUseMetrics.mockReturnValue({
      accuracyMetrics: null,
      processingStats: null,
      isLoading: false,
      error: 'Network error',
      lastUpdated: null,
      refresh: vi.fn(),
    });

    render(<MetricsDashboard />);
    expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('displays metrics when data is loaded', () => {
    const mockAccuracyMetrics = {
      overall: 0.92,
      byCategory: {
        ocr: 0.94,
        annotationDetection: 0.89,
        intentClassification: 0.93,
      },
      byUseCase: [],
      trend: [],
    };

    const mockProcessingStats = {
      averageTime: 4.5,
      successRate: 0.96,
      totalProcessed: 1250,
      confidenceDistribution: [],
    };

    mockUseMetrics.mockReturnValue({
      accuracyMetrics: mockAccuracyMetrics,
      processingStats: mockProcessingStats,
      isLoading: false,
      error: null,
      lastUpdated: new Date(),
      refresh: vi.fn(),
    });

    render(<MetricsDashboard />);
    expect(screen.getByText('Accuracy Metrics')).toBeInTheDocument();
    expect(screen.getByText('Processing Statistics')).toBeInTheDocument();
  });

  it('calls refresh function when refresh button is clicked', async () => {
    const mockRefresh = vi.fn();
    mockUseMetrics.mockReturnValue({
      accuracyMetrics: null,
      processingStats: null,
      isLoading: false,
      error: null,
      lastUpdated: new Date(),
      refresh: mockRefresh,
    });

    render(<MetricsDashboard />);
    // Use exact match to avoid matching "Auto-refresh ON"
    const refreshButton = screen.getByRole('button', { name: 'Refresh' });
    await userEvent.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('displays last updated timestamp', () => {
    const lastUpdated = new Date('2025-01-01T12:00:00');
    mockUseMetrics.mockReturnValue({
      accuracyMetrics: null,
      processingStats: null,
      isLoading: false,
      error: null,
      lastUpdated,
      refresh: vi.fn(),
    });

    render(<MetricsDashboard />);
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('toggles auto-refresh when button is clicked', async () => {
    mockUseMetrics.mockReturnValue({
      accuracyMetrics: null,
      processingStats: null,
      isLoading: false,
      error: null,
      lastUpdated: null,
      refresh: vi.fn(),
    });

    render(<MetricsDashboard />);
    const autoRefreshButton = screen.getByRole('button', { name: /auto-refresh on/i });
    
    await userEvent.click(autoRefreshButton);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /auto-refresh off/i })).toBeInTheDocument();
    });
  });

  it('displays empty state when no metrics are available', () => {
    mockUseMetrics.mockReturnValue({
      accuracyMetrics: null,
      processingStats: null,
      isLoading: false,
      error: null,
      lastUpdated: null,
      refresh: vi.fn(),
    });

    render(<MetricsDashboard />);
    expect(screen.getByText('No metrics available yet')).toBeInTheDocument();
    expect(screen.getByText('Try the demo to generate processing metrics!')).toBeInTheDocument();
  });
});
