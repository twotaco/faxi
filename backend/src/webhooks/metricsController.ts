import { Request, Response, Router } from 'express';
import { metricsCalculationService } from '../services/metricsCalculationService';
import { loggingService } from '../services/loggingService';

const router = Router();

// Simple in-memory cache
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached data or fetch new data
 */
async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data as T;
  }

  try {
    const data = await fetchFn();
    cache.set(key, { data, timestamp: now });
    return data;
  } catch (error) {
    // If fetch fails and we have stale cache, return it
    if (cached) {
      loggingService.warn('Using stale cache due to fetch error', { key, error });
      return cached.data as T;
    }
    throw error;
  }
}

/**
 * GET /api/metrics/accuracy
 * Return accuracy metrics
 */
router.get('/accuracy', async (req: Request, res: Response) => {
  try {
    const metrics = await getCachedOrFetch(
      'accuracy-metrics',
      () => metricsCalculationService.calculateAccuracyMetrics()
    );

    // Check if we have any data
    if (metrics.overall === 0 && metrics.byCategory.ocr === 0) {
      return res.json({
        overall: 0,
        byCategory: { ocr: 0, annotation: 0, intent: 0 },
        byUseCase: [],
        trend: [],
        message: 'No processing data available yet. Try the demo to generate metrics!',
        lastUpdated: new Date().toISOString()
      });
    }

    res.json({
      ...metrics,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    loggingService.error('Failed to fetch accuracy metrics', error as Error);

    // Try to return cached data
    const cached = cache.get('accuracy-metrics');
    if (cached) {
      return res.json({
        ...cached.data,
        cached: true,
        lastUpdated: new Date(cached.timestamp).toISOString()
      });
    }

    res.status(500).json({
      error: 'Unable to fetch metrics',
      overall: 0,
      byCategory: { ocr: 0, annotation: 0, intent: 0 },
      byUseCase: [],
      trend: []
    });
  }
});

/**
 * GET /api/metrics/processing-stats
 * Return processing statistics
 */
router.get('/processing-stats', async (req: Request, res: Response) => {
  try {
    const stats = await getCachedOrFetch(
      'processing-stats',
      () => metricsCalculationService.calculateProcessingStats()
    );

    // Check if we have any data
    if (stats.totalProcessed === 0) {
      return res.json({
        averageTime: 0,
        medianTime: 0,
        p95Time: 0,
        successRate: 0,
        totalProcessed: 0,
        confidenceDistribution: [],
        byUseCase: [],
        message: 'No processing data available yet. Try the demo to generate metrics!',
        lastUpdated: new Date().toISOString()
      });
    }

    res.json({
      ...stats,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    loggingService.error('Failed to fetch processing stats', error as Error);

    // Try to return cached data
    const cached = cache.get('processing-stats');
    if (cached) {
      return res.json({
        ...cached.data,
        cached: true,
        lastUpdated: new Date(cached.timestamp).toISOString()
      });
    }

    res.status(500).json({
      error: 'Unable to fetch processing statistics',
      averageTime: 0,
      medianTime: 0,
      p95Time: 0,
      successRate: 0,
      totalProcessed: 0,
      confidenceDistribution: [],
      byUseCase: []
    });
  }
});

/**
 * POST /api/metrics/refresh
 * Manually refresh metrics cache
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Clear cache
    cache.clear();

    // Fetch fresh data
    const [accuracy, stats] = await Promise.all([
      metricsCalculationService.calculateAccuracyMetrics(),
      metricsCalculationService.calculateProcessingStats()
    ]);

    // Update cache
    const now = Date.now();
    cache.set('accuracy-metrics', { data: accuracy, timestamp: now });
    cache.set('processing-stats', { data: stats, timestamp: now });

    res.json({
      message: 'Metrics refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    loggingService.error('Failed to refresh metrics', error as Error);
    res.status(500).json({ error: 'Failed to refresh metrics' });
  }
});

/**
 * GET /api/metrics/summary
 * Return combined summary of key metrics
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const [accuracy, stats] = await Promise.all([
      getCachedOrFetch('accuracy-metrics', () => metricsCalculationService.calculateAccuracyMetrics()),
      getCachedOrFetch('processing-stats', () => metricsCalculationService.calculateProcessingStats())
    ]);

    res.json({
      accuracy: {
        overall: accuracy.overall,
        byCategory: accuracy.byCategory
      },
      processing: {
        averageTime: stats.averageTime,
        successRate: stats.successRate,
        totalProcessed: stats.totalProcessed
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    loggingService.error('Failed to fetch metrics summary', error as Error);
    res.status(500).json({ error: 'Failed to fetch metrics summary' });
  }
});

export const metricsController = router;
