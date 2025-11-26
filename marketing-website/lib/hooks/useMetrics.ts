'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import type { AccuracyMetrics, ProcessingStats } from '@/lib/api/types';

export function useMetrics(refreshInterval?: number) {
  const [accuracyMetrics, setAccuracyMetrics] = useState<AccuracyMetrics | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [accuracy, stats] = await Promise.all([
        apiClient.get<AccuracyMetrics>('/api/metrics/accuracy'),
        apiClient.get<ProcessingStats>('/api/metrics/processing-stats'),
      ]);
      
      setAccuracyMetrics(accuracy);
      setProcessingStats(stats);
      setLastUpdated(new Date());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    if (refreshInterval) {
      const interval = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  return {
    accuracyMetrics,
    processingStats,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchMetrics,
  };
}
