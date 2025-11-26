import { Pool } from 'pg';
import { pool } from '../database/connection';

export interface AccuracyMetrics {
  overall: number;
  byCategory: {
    ocr: number;
    annotation: number;
    intent: number;
  };
  byUseCase: Array<{
    useCase: string;
    accuracy: number;
    sampleCount: number;
  }>;
  trend: Array<{
    date: string;
    accuracy: number;
  }>;
}

export interface ProcessingStats {
  averageTime: number;
  medianTime: number;
  p95Time: number;
  successRate: number;
  totalProcessed: number;
  confidenceDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  byUseCase: Array<{
    useCase: string;
    avgTime: number;
    successRate: number;
  }>;
}

export class MetricsCalculationService {
  private dbPool: Pool;

  constructor() {
    this.dbPool = pool;
  }

  /**
   * Calculate overall accuracy from processing_metrics table
   */
  async calculateAccuracyMetrics(): Promise<AccuracyMetrics> {
    try {
      // Calculate overall accuracy
      const overallResult = await this.dbPool.query(`
        SELECT AVG(accuracy) as avg_accuracy
        FROM processing_metrics
        WHERE success = true AND accuracy IS NOT NULL
      `);
      const overall = parseFloat(overallResult.rows[0]?.avg_accuracy || '0');

      // Calculate accuracy by category
      const categoryResult = await this.dbPool.query(`
        SELECT 
          metric_type,
          AVG(accuracy) as avg_accuracy
        FROM processing_metrics
        WHERE success = true AND accuracy IS NOT NULL
        GROUP BY metric_type
      `);

      const byCategory = {
        ocr: 0,
        annotation: 0,
        intent: 0
      };

      categoryResult.rows.forEach(row => {
        const accuracy = parseFloat(row.avg_accuracy);
        if (row.metric_type === 'ocr') byCategory.ocr = accuracy;
        if (row.metric_type === 'annotation') byCategory.annotation = accuracy;
        if (row.metric_type === 'intent') byCategory.intent = accuracy;
      });

      // Calculate accuracy by use case (from fax_jobs intent)
      const useCaseResult = await this.dbPool.query(`
        SELECT 
          fj.intent as use_case,
          AVG(pm.accuracy) as avg_accuracy,
          COUNT(DISTINCT pm.fax_job_id) as sample_count
        FROM processing_metrics pm
        JOIN fax_jobs fj ON pm.fax_job_id = fj.id
        WHERE pm.success = true AND pm.accuracy IS NOT NULL
        GROUP BY fj.intent
        ORDER BY sample_count DESC
      `);

      const byUseCase = useCaseResult.rows.map(row => ({
        useCase: row.use_case || 'unknown',
        accuracy: parseFloat(row.avg_accuracy),
        sampleCount: parseInt(row.sample_count, 10)
      }));

      // Get accuracy trend over time (last 30 days)
      const trendResult = await this.dbPool.query(`
        SELECT 
          DATE(created_at) as date,
          AVG(accuracy) as avg_accuracy
        FROM processing_metrics
        WHERE success = true 
          AND accuracy IS NOT NULL
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

      const trend = trendResult.rows.map(row => ({
        date: row.date.toISOString().split('T')[0],
        accuracy: parseFloat(row.avg_accuracy)
      }));

      return {
        overall,
        byCategory,
        byUseCase,
        trend
      };
    } catch (error) {
      console.error('Error calculating accuracy metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate processing statistics
   */
  async calculateProcessingStats(): Promise<ProcessingStats> {
    try {
      // Calculate average, median, and p95 processing time
      const timeResult = await this.dbPool.query(`
        SELECT 
          AVG(processing_time_ms) as avg_time,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_time_ms) as median_time,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_time
        FROM processing_metrics
        WHERE processing_time_ms IS NOT NULL
      `);

      const averageTime = parseInt(timeResult.rows[0]?.avg_time || '0', 10);
      const medianTime = parseInt(timeResult.rows[0]?.median_time || '0', 10);
      const p95Time = parseInt(timeResult.rows[0]?.p95_time || '0', 10);

      // Calculate success rate
      const successResult = await this.dbPool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful
        FROM processing_metrics
      `);

      const total = parseInt(successResult.rows[0]?.total || '0', 10);
      const successful = parseInt(successResult.rows[0]?.successful || '0', 10);
      const successRate = total > 0 ? (successful / total) * 100 : 0;

      // Calculate confidence distribution
      const confidenceResult = await this.dbPool.query(`
        SELECT 
          CASE 
            WHEN confidence >= 0.9 THEN '0.9-1.0'
            WHEN confidence >= 0.7 THEN '0.7-0.89'
            WHEN confidence >= 0.5 THEN '0.5-0.69'
            WHEN confidence >= 0.3 THEN '0.3-0.49'
            ELSE '0.0-0.29'
          END as range,
          COUNT(*) as count
        FROM processing_metrics
        WHERE confidence IS NOT NULL
        GROUP BY range
        ORDER BY range DESC
      `);

      const totalWithConfidence = confidenceResult.rows.reduce((sum, row) => sum + parseInt(row.count, 10), 0);
      const confidenceDistribution = confidenceResult.rows.map(row => {
        const count = parseInt(row.count, 10);
        return {
          range: row.range,
          count,
          percentage: totalWithConfidence > 0 ? (count / totalWithConfidence) * 100 : 0
        };
      });

      // Calculate stats by use case
      const useCaseStatsResult = await this.dbPool.query(`
        SELECT 
          fj.intent as use_case,
          AVG(pm.processing_time_ms) as avg_time,
          (SUM(CASE WHEN pm.success = true THEN 1 ELSE 0 END)::float / COUNT(*)::float * 100) as success_rate
        FROM processing_metrics pm
        JOIN fax_jobs fj ON pm.fax_job_id = fj.id
        WHERE pm.processing_time_ms IS NOT NULL
        GROUP BY fj.intent
      `);

      const byUseCase = useCaseStatsResult.rows.map(row => ({
        useCase: row.use_case || 'unknown',
        avgTime: parseInt(row.avg_time || '0', 10),
        successRate: parseFloat(row.success_rate || '0')
      }));

      return {
        averageTime,
        medianTime,
        p95Time,
        successRate,
        totalProcessed: total,
        confidenceDistribution,
        byUseCase
      };
    } catch (error) {
      console.error('Error calculating processing stats:', error);
      throw error;
    }
  }

  /**
   * Create accuracy snapshot for historical tracking
   */
  async createAccuracySnapshot(): Promise<void> {
    try {
      const metrics = await this.calculateAccuracyMetrics();
      const stats = await this.calculateProcessingStats();

      await this.dbPool.query(`
        INSERT INTO accuracy_snapshots (
          snapshot_date,
          overall_accuracy,
          ocr_accuracy,
          annotation_accuracy,
          intent_accuracy,
          sample_count,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (snapshot_date) 
        DO UPDATE SET
          overall_accuracy = EXCLUDED.overall_accuracy,
          ocr_accuracy = EXCLUDED.ocr_accuracy,
          annotation_accuracy = EXCLUDED.annotation_accuracy,
          intent_accuracy = EXCLUDED.intent_accuracy,
          sample_count = EXCLUDED.sample_count,
          metadata = EXCLUDED.metadata,
          created_at = CURRENT_TIMESTAMP
      `, [
        new Date().toISOString().split('T')[0], // Today's date
        metrics.overall,
        metrics.byCategory.ocr,
        metrics.byCategory.annotation,
        metrics.byCategory.intent,
        stats.totalProcessed,
        JSON.stringify({
          byUseCase: metrics.byUseCase,
          successRate: stats.successRate
        })
      ]);

      console.log('Accuracy snapshot created successfully');
    } catch (error) {
      console.error('Error creating accuracy snapshot:', error);
      throw error;
    }
  }

  /**
   * Log processing metrics for a fax job
   */
  async logProcessingMetric(
    faxJobId: string,
    metricType: 'ocr' | 'annotation' | 'intent',
    accuracy: number,
    confidence: number,
    processingTimeMs: number,
    success: boolean,
    errorMessage?: string,
    metadata?: any
  ): Promise<void> {
    try {
      await this.dbPool.query(`
        INSERT INTO processing_metrics (
          fax_job_id,
          metric_type,
          accuracy,
          confidence,
          processing_time_ms,
          success,
          error_message,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        faxJobId,
        metricType,
        accuracy,
        confidence,
        processingTimeMs,
        success,
        errorMessage || null,
        metadata ? JSON.stringify(metadata) : null
      ]);
    } catch (error) {
      console.error('Error logging processing metric:', error);
      // Don't throw - metrics logging shouldn't break the main flow
    }
  }
}

// Export singleton instance
export const metricsCalculationService = new MetricsCalculationService();
