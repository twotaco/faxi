import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { db } from '../database/connection';
import { redis } from '../queue/connection';
import { s3Storage } from '../storage/s3';
import { checkQueueHealth } from '../queue/faxQueue';

interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down' | 'degraded';
    redis: 'up' | 'down' | 'degraded';
    s3: 'up' | 'down' | 'degraded';
    faxQueue: 'up' | 'down' | 'degraded';
    emailQueue: 'up' | 'down' | 'degraded';
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    activeConnections: number;
    queueSizes: {
      faxProcessing: number;
      emailToFax: number;
    };
    cache?: {
      hits: number;
      misses: number;
      invalidations: number;
      hitRate: number;
    };
  };
}

interface AlertRule {
  name: string;
  condition: (metrics: any) => boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  cooldown: number; // minutes
  lastTriggered?: Date;
}

class MonitoringService {
  private static instance: MonitoringService;
  private metrics: Map<string, MetricData[]> = new Map();
  private alerts: AlertRule[] = [];
  private startTime: Date = new Date();
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeSum = 0;
  private activeRequests = 0;

  private constructor() {
    this.setupDefaultAlerts();
    this.startMetricsCollection();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Express middleware for request monitoring
   */
  public requestMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      this.activeRequests++;
      this.requestCount++;

      // Override res.end to capture response metrics
      const originalEnd = res.end.bind(res);
      (res as any).end = (chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        const monitoring = MonitoringService.getInstance();
        monitoring.activeRequests--;
        monitoring.responseTimeSum += responseTime;

        // Record metrics
        monitoring.recordMetric('http_requests_total', 1, {
          method: req.method,
          route: req.route?.path || req.path,
          status: res.statusCode.toString(),
        });

        monitoring.recordMetric('http_request_duration_ms', responseTime, {
          method: req.method,
          route: req.route?.path || req.path,
        });

        if (res.statusCode >= 400) {
          monitoring.errorCount++;
          monitoring.recordMetric('http_errors_total', 1, {
            method: req.method,
            route: req.route?.path || req.path,
            status: res.statusCode.toString(),
          });
        }

        return originalEnd(chunk, encoding as BufferEncoding, cb);
      };

      next();
    };
  }

  /**
   * Record a custom metric
   */
  public recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const metric: MetricData = {
      name,
      value,
      labels,
      timestamp: new Date(),
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Keep only last 1000 metrics per type to prevent memory leaks
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }
  }

  /**
   * Get comprehensive health status
   */
  public async getHealthStatus(): Promise<HealthStatus> {
    try {
      const [dbHealthy, redisHealthy, s3Healthy, queueHealth] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkRedisHealth(),
        this.checkS3Health(),
        this.checkQueueHealth(),
      ]);

      const queueSizes = await this.getQueueSizes();
      const cacheMetrics = await this.getCacheMetrics();
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = Date.now() - this.startTime.getTime();

      const services = {
        database: dbHealthy.status,
        redis: redisHealthy.status,
        s3: s3Healthy.status,
        faxQueue: queueHealth.faxProcessing ? 'up' as const : 'down' as const,
        emailQueue: queueHealth.emailToFax ? 'up' as const : 'down' as const,
      };

      // Determine overall status
      const criticalDown = Object.values(services).some(status => status === 'down');
      const degraded = Object.values(services).some(status => status === 'degraded');
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
      if (criticalDown) {
        overallStatus = 'unhealthy';
      } else if (degraded) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'healthy';
      }

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services,
        metrics: {
          uptime,
          memoryUsage,
          cpuUsage,
          activeConnections: this.activeRequests,
          queueSizes,
          cache: cacheMetrics,
        },
      };
    } catch (error) {
      console.error('Health check error:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'down',
          redis: 'down',
          s3: 'down',
          faxQueue: 'down',
          emailQueue: 'down',
        },
        metrics: {
          uptime: Date.now() - this.startTime.getTime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          activeConnections: this.activeRequests,
          queueSizes: { faxProcessing: 0, emailToFax: 0 },
        },
      };
    }
  }

  /**
   * Get Prometheus-formatted metrics
   */
  public getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Add basic application metrics
    lines.push(`# HELP faxi_uptime_seconds Application uptime in seconds`);
    lines.push(`# TYPE faxi_uptime_seconds counter`);
    lines.push(`faxi_uptime_seconds ${(Date.now() - this.startTime.getTime()) / 1000}`);
    
    lines.push(`# HELP faxi_requests_total Total HTTP requests`);
    lines.push(`# TYPE faxi_requests_total counter`);
    lines.push(`faxi_requests_total ${this.requestCount}`);
    
    lines.push(`# HELP faxi_errors_total Total HTTP errors`);
    lines.push(`# TYPE faxi_errors_total counter`);
    lines.push(`faxi_errors_total ${this.errorCount}`);
    
    lines.push(`# HELP faxi_active_requests Current active requests`);
    lines.push(`# TYPE faxi_active_requests gauge`);
    lines.push(`faxi_active_requests ${this.activeRequests}`);
    
    const avgResponseTime = this.requestCount > 0 ? this.responseTimeSum / this.requestCount : 0;
    lines.push(`# HELP faxi_avg_response_time_ms Average response time in milliseconds`);
    lines.push(`# TYPE faxi_avg_response_time_ms gauge`);
    lines.push(`faxi_avg_response_time_ms ${avgResponseTime}`);

    // Add cache metrics
    try {
      const { productCacheService } = require('./productCacheService');
      const cacheMetrics = productCacheService.getCacheMetrics();
      const hitRate = productCacheService.getCacheHitRate();
      
      lines.push(`# HELP faxi_cache_hits_total Total cache hits`);
      lines.push(`# TYPE faxi_cache_hits_total counter`);
      lines.push(`faxi_cache_hits_total ${cacheMetrics.hits}`);
      
      lines.push(`# HELP faxi_cache_misses_total Total cache misses`);
      lines.push(`# TYPE faxi_cache_misses_total counter`);
      lines.push(`faxi_cache_misses_total ${cacheMetrics.misses}`);
      
      lines.push(`# HELP faxi_cache_invalidations_total Total cache invalidations`);
      lines.push(`# TYPE faxi_cache_invalidations_total counter`);
      lines.push(`faxi_cache_invalidations_total ${cacheMetrics.invalidations}`);
      
      lines.push(`# HELP faxi_cache_hit_rate Cache hit rate (0-1)`);
      lines.push(`# TYPE faxi_cache_hit_rate gauge`);
      lines.push(`faxi_cache_hit_rate ${hitRate}`);
    } catch (error) {
      // Cache service not available, skip metrics
    }

    // Add template generation metrics
    const templateMetrics = this.getTemplateMetrics();
    lines.push(`# HELP faxi_template_generations_total Total template generations`);
    lines.push(`# TYPE faxi_template_generations_total counter`);
    lines.push(`faxi_template_generations_total ${templateMetrics.totalGenerations}`);
    
    lines.push(`# HELP faxi_template_success_rate Template generation success rate (0-1)`);
    lines.push(`# TYPE faxi_template_success_rate gauge`);
    lines.push(`faxi_template_success_rate ${templateMetrics.successRate}`);
    
    lines.push(`# HELP faxi_template_avg_generation_time_ms Average template generation time in milliseconds`);
    lines.push(`# TYPE faxi_template_avg_generation_time_ms gauge`);
    lines.push(`faxi_template_avg_generation_time_ms ${templateMetrics.avgGenerationTime}`);
    
    // Add per-template-type metrics
    for (const [templateType, data] of Object.entries(templateMetrics.byTemplateType)) {
      lines.push(`# HELP faxi_template_count_by_type Template generation count by type`);
      lines.push(`# TYPE faxi_template_count_by_type counter`);
      lines.push(`faxi_template_count_by_type{template_type="${templateType}"} ${data.count}`);
      
      lines.push(`# HELP faxi_template_avg_time_by_type Average generation time by type`);
      lines.push(`# TYPE faxi_template_avg_time_by_type gauge`);
      lines.push(`faxi_template_avg_time_by_type{template_type="${templateType}"} ${data.avgTime}`);
      
      lines.push(`# HELP faxi_template_success_rate_by_type Success rate by type (0-1)`);
      lines.push(`# TYPE faxi_template_success_rate_by_type gauge`);
      lines.push(`faxi_template_success_rate_by_type{template_type="${templateType}"} ${data.successRate}`);
    }
    
    // Add image processing metrics
    const imageMetrics = this.getImageProcessingMetrics();
    lines.push(`# HELP faxi_image_operations_total Total image processing operations`);
    lines.push(`# TYPE faxi_image_operations_total counter`);
    lines.push(`faxi_image_operations_total ${imageMetrics.totalOperations}`);
    
    lines.push(`# HELP faxi_image_cache_hit_rate Image cache hit rate (0-1)`);
    lines.push(`# TYPE faxi_image_cache_hit_rate gauge`);
    lines.push(`faxi_image_cache_hit_rate ${imageMetrics.cacheHitRate}`);
    
    lines.push(`# HELP faxi_image_avg_download_time_ms Average image download time in milliseconds`);
    lines.push(`# TYPE faxi_image_avg_download_time_ms gauge`);
    lines.push(`faxi_image_avg_download_time_ms ${imageMetrics.avgDownloadTime}`);
    
    lines.push(`# HELP faxi_image_avg_process_time_ms Average image processing time in milliseconds`);
    lines.push(`# TYPE faxi_image_avg_process_time_ms gauge`);
    lines.push(`faxi_image_avg_process_time_ms ${imageMetrics.avgProcessTime}`);

    // Add memory metrics
    const memory = process.memoryUsage();
    lines.push(`# HELP faxi_memory_usage_bytes Memory usage in bytes`);
    lines.push(`# TYPE faxi_memory_usage_bytes gauge`);
    lines.push(`faxi_memory_usage_bytes{type="rss"} ${memory.rss}`);
    lines.push(`faxi_memory_usage_bytes{type="heapTotal"} ${memory.heapTotal}`);
    lines.push(`faxi_memory_usage_bytes{type="heapUsed"} ${memory.heapUsed}`);
    lines.push(`faxi_memory_usage_bytes{type="external"} ${memory.external}`);

    // Add custom metrics
    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue;
      
      const latestMetrics = metrics.slice(-10); // Get last 10 metrics
      lines.push(`# HELP ${name} Custom metric`);
      lines.push(`# TYPE ${name} gauge`);
      
      for (const metric of latestMetrics) {
        const labels = metric.labels 
          ? Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`).join(',')
          : '';
        const labelStr = labels ? `{${labels}}` : '';
        lines.push(`${name}${labelStr} ${metric.value} ${metric.timestamp.getTime()}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Check for alert conditions and trigger alerts
   */
  public async checkAlerts(): Promise<void> {
    const healthStatus = await this.getHealthStatus();
    const now = new Date();

    for (const alert of this.alerts) {
      // Check cooldown period
      if (alert.lastTriggered) {
        const cooldownMs = alert.cooldown * 60 * 1000;
        if (now.getTime() - alert.lastTriggered.getTime() < cooldownMs) {
          continue;
        }
      }

      // Check alert condition
      if (alert.condition(healthStatus)) {
        await this.triggerAlert(alert, healthStatus);
        alert.lastTriggered = now;
      }
    }
  }

  /**
   * Get application logs for monitoring
   */
  public async getApplicationLogs(
    level?: 'error' | 'warn' | 'info' | 'debug',
    limit: number = 100
  ): Promise<any[]> {
    // In a production system, this would query a log aggregation system
    // For now, return recent error logs from database
    try {
      const query = `
        SELECT created_at, level, message, metadata
        FROM audit_logs 
        WHERE level = $1 OR $1 IS NULL
        ORDER BY created_at DESC 
        LIMIT $2
      `;
      
      const result = await db.query(query, [level, limit]);
      return result.rows;
    } catch (error) {
      console.error('Failed to fetch application logs:', error);
      return [];
    }
  }

  private async checkDatabaseHealth(): Promise<{ status: 'up' | 'down' | 'degraded'; responseTime?: number }> {
    const start = performance.now();
    try {
      const healthy = await db.healthCheck();
      const responseTime = performance.now() - start;
      
      // Consider degraded if response time > 1000ms
      if (healthy && responseTime > 1000) {
        return { status: 'degraded', responseTime };
      }
      
      return { status: healthy ? 'up' : 'down', responseTime };
    } catch (error) {
      return { status: 'down' };
    }
  }

  private async checkRedisHealth(): Promise<{ status: 'up' | 'down' | 'degraded'; responseTime?: number }> {
    const start = performance.now();
    try {
      const healthy = await redis.healthCheck();
      const responseTime = performance.now() - start;
      
      // Consider degraded if response time > 500ms
      if (healthy && responseTime > 500) {
        return { status: 'degraded', responseTime };
      }
      
      return { status: healthy ? 'up' : 'down', responseTime };
    } catch (error) {
      return { status: 'down' };
    }
  }

  private async checkS3Health(): Promise<{ status: 'up' | 'down' | 'degraded'; responseTime?: number }> {
    const start = performance.now();
    try {
      const healthy = await s3Storage.healthCheck();
      const responseTime = performance.now() - start;
      
      // Consider degraded if response time > 2000ms
      if (healthy && responseTime > 2000) {
        return { status: 'degraded', responseTime };
      }
      
      return { status: healthy ? 'up' : 'down', responseTime };
    } catch (error) {
      return { status: 'down' };
    }
  }

  private async checkQueueHealth(): Promise<{ faxProcessing: boolean; emailToFax: boolean }> {
    try {
      return await checkQueueHealth();
    } catch (error) {
      return { faxProcessing: false, emailToFax: false };
    }
  }

  private async getQueueSizes(): Promise<{ faxProcessing: number; emailToFax: number }> {
    try {
      const client = redis.getClient();
      const [faxProcessing, emailToFax] = await Promise.all([
        client.llen('bull:fax-processing:waiting'),
        client.llen('bull:email-to-fax:waiting'),
      ]);
      
      return { faxProcessing, emailToFax };
    } catch (error) {
      console.error('Failed to get queue sizes:', error);
      return { faxProcessing: 0, emailToFax: 0 };
    }
  }

  private setupDefaultAlerts(): void {
    this.alerts = [
      {
        name: 'HighErrorRate',
        condition: (health) => {
          const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;
          return errorRate > 0.1; // 10% error rate
        },
        severity: 'critical',
        message: 'High error rate detected',
        cooldown: 5,
      },
      {
        name: 'HighMemoryUsage',
        condition: (health) => {
          const memUsage = health.metrics.memoryUsage;
          return memUsage.heapUsed / memUsage.heapTotal > 0.9; // 90% heap usage
        },
        severity: 'warning',
        message: 'High memory usage detected',
        cooldown: 10,
      },
      {
        name: 'DatabaseDown',
        condition: (health) => health.services.database === 'down',
        severity: 'critical',
        message: 'Database is down',
        cooldown: 1,
      },
      {
        name: 'RedisDown',
        condition: (health) => health.services.redis === 'down',
        severity: 'critical',
        message: 'Redis is down',
        cooldown: 1,
      },
      {
        name: 'QueueBacklog',
        condition: (health) => {
          const totalQueue = health.metrics.queueSizes.faxProcessing + health.metrics.queueSizes.emailToFax;
          return totalQueue > 100;
        },
        severity: 'warning',
        message: 'Large queue backlog detected',
        cooldown: 15,
      },
    ];
  }

  private async triggerAlert(alert: AlertRule, healthStatus: HealthStatus): Promise<void> {
    const alertData = {
      name: alert.name,
      severity: alert.severity,
      message: alert.message,
      timestamp: new Date().toISOString(),
      healthStatus,
    };

    console.error(`ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`, alertData);

    // Record alert metric
    this.recordMetric('faxi_alerts_total', 1, {
      name: alert.name,
      severity: alert.severity,
    });

    // In production, this would:
    // 1. Send to PagerDuty/OpsGenie
    // 2. Post to Slack/Teams
    // 3. Send email/SMS to on-call
    // 4. Update status page
    
    try {
      // Store alert in database for audit trail
      await db.query(
        `INSERT INTO application_logs (level, message, context, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        ['error', `Alert: ${alert.message}`, JSON.stringify({ source: 'monitoring' }), JSON.stringify(alertData), new Date()]
      );
    } catch (error) {
      console.error('Failed to store alert in database:', error);
    }
  }

  private startMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(async () => {
      try {
        const healthStatus = await this.getHealthStatus();
        
        // Record system metrics
        this.recordMetric('faxi_memory_heap_used', healthStatus.metrics.memoryUsage.heapUsed);
        this.recordMetric('faxi_memory_heap_total', healthStatus.metrics.memoryUsage.heapTotal);
        this.recordMetric('faxi_active_connections', healthStatus.metrics.activeConnections);
        this.recordMetric('faxi_queue_fax_processing', healthStatus.metrics.queueSizes.faxProcessing);
        this.recordMetric('faxi_queue_email_to_fax', healthStatus.metrics.queueSizes.emailToFax);

        // Check alerts
        await this.checkAlerts();
      } catch (error) {
        console.error('Metrics collection error:', error);
      }
    }, 30000);

    // Clean up old metrics every hour
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      for (const [name, metrics] of this.metrics.entries()) {
        const filtered = metrics.filter(m => m.timestamp > oneHourAgo);
        this.metrics.set(name, filtered);
      }
    }, 60 * 60 * 1000);
  }
  /**
   * Get product cache metrics
   */
  public async getCacheMetrics(): Promise<{
    hits: number;
    misses: number;
    invalidations: number;
    hitRate: number;
  }> {
    try {
      // Import here to avoid circular dependency
      const { productCacheService } = await import('./productCacheService');
      const metrics = productCacheService.getCacheMetrics();
      const hitRate = productCacheService.getCacheHitRate();
      
      return {
        ...metrics,
        hitRate
      };
    } catch (error) {
      console.error('Failed to get cache metrics:', error);
      return {
        hits: 0,
        misses: 0,
        invalidations: 0,
        hitRate: 0
      };
    }
  }

  /**
   * Record template generation metrics
   * 
   * @param templateType - Type of template generated
   * @param generationTimeMs - Time taken to generate in milliseconds
   * @param pageCount - Number of pages in the generated fax
   * @param imageCount - Number of images included
   * @param imageCacheHits - Number of images served from cache
   * @param imageCacheMisses - Number of images downloaded fresh
   * @param success - Whether generation succeeded
   * @param error - Error type if generation failed
   */
  public recordTemplateGeneration(
    templateType: string,
    generationTimeMs: number,
    pageCount: number,
    imageCount: number,
    imageCacheHits: number,
    imageCacheMisses: number,
    success: boolean,
    error?: string
  ): void {
    // Record generation time
    this.recordMetric('template_generation_duration_ms', generationTimeMs, {
      template_type: templateType,
      success: success.toString()
    });

    // Record page count
    this.recordMetric('template_page_count', pageCount, {
      template_type: templateType
    });

    // Record image metrics
    if (imageCount > 0) {
      this.recordMetric('template_image_count', imageCount, {
        template_type: templateType
      });

      this.recordMetric('template_image_cache_hits', imageCacheHits, {
        template_type: templateType
      });

      this.recordMetric('template_image_cache_misses', imageCacheMisses, {
        template_type: templateType
      });

      const cacheHitRate = imageCount > 0 ? imageCacheHits / imageCount : 0;
      this.recordMetric('template_image_cache_hit_rate', cacheHitRate, {
        template_type: templateType
      });
    }

    // Record success/failure
    this.recordMetric('template_generation_total', 1, {
      template_type: templateType,
      success: success.toString()
    });

    // Record error type if failed
    if (!success && error) {
      this.recordMetric('template_generation_errors', 1, {
        template_type: templateType,
        error_type: error
      });
    }
  }

  /**
   * Record image processing metrics
   * 
   * @param operation - Operation type (download, resize, cache)
   * @param durationMs - Time taken in milliseconds
   * @param success - Whether operation succeeded
   * @param cacheHit - Whether image was served from cache
   */
  public recordImageProcessing(
    operation: 'download' | 'resize' | 'cache' | 'process',
    durationMs: number,
    success: boolean,
    cacheHit?: boolean
  ): void {
    this.recordMetric('image_processing_duration_ms', durationMs, {
      operation,
      success: success.toString(),
      cache_hit: cacheHit?.toString() || 'n/a'
    });

    this.recordMetric('image_processing_total', 1, {
      operation,
      success: success.toString()
    });

    if (cacheHit !== undefined) {
      this.recordMetric('image_cache_operations', 1, {
        result: cacheHit ? 'hit' : 'miss'
      });
    }
  }

  /**
   * Get template generation metrics summary
   */
  public getTemplateMetrics(): {
    totalGenerations: number;
    successRate: number;
    avgGenerationTime: number;
    byTemplateType: Record<string, {
      count: number;
      avgTime: number;
      successRate: number;
    }>;
  } {
    const generationMetrics = this.metrics.get('template_generation_total') || [];
    const timeMetrics = this.metrics.get('template_generation_duration_ms') || [];

    const totalGenerations = generationMetrics.length;
    const successfulGenerations = generationMetrics.filter(
      m => m.labels?.success === 'true'
    ).length;
    const successRate = totalGenerations > 0 ? successfulGenerations / totalGenerations : 0;

    const totalTime = timeMetrics.reduce((sum, m) => sum + m.value, 0);
    const avgGenerationTime = timeMetrics.length > 0 ? totalTime / timeMetrics.length : 0;

    // Group by template type
    const byTemplateType: Record<string, {
      count: number;
      avgTime: number;
      successRate: number;
    }> = {};

    for (const metric of generationMetrics) {
      const templateType = metric.labels?.template_type || 'unknown';
      if (!byTemplateType[templateType]) {
        byTemplateType[templateType] = {
          count: 0,
          avgTime: 0,
          successRate: 0
        };
      }
      byTemplateType[templateType].count++;
      if (metric.labels?.success === 'true') {
        byTemplateType[templateType].successRate++;
      }
    }

    for (const metric of timeMetrics) {
      const templateType = metric.labels?.template_type || 'unknown';
      if (byTemplateType[templateType]) {
        byTemplateType[templateType].avgTime += metric.value;
      }
    }

    // Calculate averages
    for (const templateType in byTemplateType) {
      const data = byTemplateType[templateType];
      data.avgTime = data.count > 0 ? data.avgTime / data.count : 0;
      data.successRate = data.count > 0 ? data.successRate / data.count : 0;
    }

    return {
      totalGenerations,
      successRate,
      avgGenerationTime,
      byTemplateType
    };
  }

  /**
   * Get image processing metrics summary
   */
  public getImageProcessingMetrics(): {
    totalOperations: number;
    cacheHitRate: number;
    avgDownloadTime: number;
    avgProcessTime: number;
  } {
    const processingMetrics = this.metrics.get('image_processing_total') || [];
    const cacheMetrics = this.metrics.get('image_cache_operations') || [];
    const timeMetrics = this.metrics.get('image_processing_duration_ms') || [];

    const totalOperations = processingMetrics.length;
    const cacheHits = cacheMetrics.filter(m => m.labels?.result === 'hit').length;
    const cacheMisses = cacheMetrics.filter(m => m.labels?.result === 'miss').length;
    const cacheHitRate = (cacheHits + cacheMisses) > 0 
      ? cacheHits / (cacheHits + cacheMisses) 
      : 0;

    const downloadTimes = timeMetrics.filter(m => m.labels?.operation === 'download');
    const avgDownloadTime = downloadTimes.length > 0
      ? downloadTimes.reduce((sum, m) => sum + m.value, 0) / downloadTimes.length
      : 0;

    const processTimes = timeMetrics.filter(m => m.labels?.operation === 'process');
    const avgProcessTime = processTimes.length > 0
      ? processTimes.reduce((sum, m) => sum + m.value, 0) / processTimes.length
      : 0;

    return {
      totalOperations,
      cacheHitRate,
      avgDownloadTime,
      avgProcessTime
    };
  }
}

export const monitoringService = MonitoringService.getInstance();