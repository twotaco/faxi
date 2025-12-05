import { Request, Response } from 'express';
import { db } from '../database/connection';
import { loggingService } from '../services/loggingService';
import { monitoringService } from '../services/monitoringService';
import { mcpMonitoringService } from '../services/mcpMonitoringService';

/**
 * Admin Dashboard Controller
 * 
 * Provides API endpoints for the admin dashboard pages:
 * - MCP Servers monitoring
 * - AI Inspector
 * - System Health
 * - Analytics
 * - Audit Logs
 */

/**
 * GET /api/admin/dashboard/mcp/stats
 * Get MCP server statistics and recent errors
 */
export async function getMcpStats(req: Request, res: Response) {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Get MCP tool call stats from audit logs
    const mcpCallsResult = await db.query(
      `SELECT 
         event_data->>'toolServer' as server_name,
         COUNT(*) as total_calls,
         SUM(CASE WHEN event_data->>'success' = 'true' THEN 1 ELSE 0 END) as successful_calls,
         SUM(CASE WHEN event_data->>'success' = 'false' THEN 1 ELSE 0 END) as failed_calls
       FROM audit_logs
       WHERE event_type = 'mcp.tool_call'
       AND created_at > $1
       GROUP BY event_data->>'toolServer'`,
      [oneHourAgo]
    );

    // Calculate success rates and format server stats
    const servers = mcpCallsResult.rows.map(row => {
      const totalCalls = parseInt(row.total_calls, 10);
      const successfulCalls = parseInt(row.successful_calls, 10);
      const failedCalls = parseInt(row.failed_calls, 10);
      const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 100;

      return {
        name: row.server_name || 'unknown',
        totalCalls,
        successRate: Math.round(successRate * 100) / 100,
        failedCount: failedCalls,
        status: successRate >= 95 ? 'up' : 'degraded',
      };
    });

    // Get recent errors (last 5 failed MCP calls)
    const recentErrorsResult = await db.query(
      `SELECT 
         event_data->>'toolServer' as tool_server,
         event_data->>'toolName' as tool_name,
         event_data->>'error' as error_message,
         user_id,
         created_at
       FROM audit_logs
       WHERE event_type = 'mcp.tool_call'
       AND event_data->>'success' = 'false'
       AND created_at > $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [oneHourAgo]
    );

    const recentErrors = recentErrorsResult.rows.map(row => ({
      toolServer: row.tool_server || 'unknown',
      toolName: row.tool_name || 'unknown',
      errorMessage: row.error_message || 'Unknown error',
      timestamp: row.created_at,
      userId: row.user_id,
    }));

    // Get external API health from monitoring service
    const externalAPIs = await mcpMonitoringService.getExternalAPIHealth();

    res.json({
      servers,
      recentErrors,
      externalAPIs,
    });
  } catch (error) {
    loggingService.error('Failed to fetch MCP stats', error as Error);
    res.status(500).json({
      error: 'Failed to fetch MCP stats',
      message: 'An error occurred while fetching MCP server statistics',
    });
  }
}

/**
 * GET /api/admin/dashboard/ai/metrics
 * Get AI processing metrics and recent processing attempts
 */
export async function getAiMetrics(req: Request, res: Response) {
  try {
    // Get aggregate metrics from processing_metrics table
    const aggregateResult = await db.query(
      `SELECT 
         COUNT(*) as total_count,
         SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as success_count,
         AVG(accuracy) as avg_accuracy,
         AVG(confidence) as avg_confidence,
         AVG(processing_time_ms) as avg_processing_time
       FROM processing_metrics
       WHERE created_at > NOW() - INTERVAL '24 hours'`
    );

    const aggregate = aggregateResult.rows[0];
    const totalCount = parseInt(aggregate.total_count, 10);
    const successCount = parseInt(aggregate.success_count, 10);
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    // Get recent processing attempts (last 20)
    const recentProcessingResult = await db.query(
      `SELECT 
         id,
         fax_job_id,
         metric_type,
         accuracy,
         confidence,
         processing_time_ms,
         success,
         error_message,
         created_at
       FROM processing_metrics
       ORDER BY created_at DESC
       LIMIT 20`
    );

    res.json({
      aggregate: {
        successRate: Math.round(successRate * 100) / 100,
        avgAccuracy: parseFloat(aggregate.avg_accuracy) || 0,
        avgConfidence: parseFloat(aggregate.avg_confidence) || 0,
        avgProcessingTime: parseFloat(aggregate.avg_processing_time) || 0,
      },
      recentProcessing: recentProcessingResult.rows.map(row => ({
        id: row.id,
        faxJobId: row.fax_job_id,
        metricType: row.metric_type,
        accuracy: parseFloat(row.accuracy) || 0,
        confidence: parseFloat(row.confidence) || 0,
        processingTime: parseFloat(row.processing_time_ms) || 0,
        success: row.success,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    loggingService.error('Failed to fetch AI metrics', error as Error);
    res.status(500).json({
      error: 'Failed to fetch AI metrics',
      message: 'An error occurred while fetching AI processing metrics',
    });
  }
}

/**
 * GET /api/admin/dashboard/health/status
 * Get system health status and recent errors
 */
export async function getHealthStatus(req: Request, res: Response) {
  try {
    // Get infrastructure status from monitoring service
    const healthStatus = await monitoringService.getHealthStatus();

    // Get recent error logs (last 50)
    const recentErrorsResult = await db.query(
      `SELECT 
         id,
         level,
         message,
         context,
         created_at
       FROM application_logs
       WHERE level = 'error'
       ORDER BY created_at DESC
       LIMIT 50`
    );

    res.json({
      infrastructure: {
        database: healthStatus.services.database,
        redis: healthStatus.services.redis,
        s3: healthStatus.services.s3,
      },
      resources: {
        memoryUsage: {
          heapUsed: healthStatus.metrics.memoryUsage.heapUsed,
          heapTotal: healthStatus.metrics.memoryUsage.heapTotal,
          percentage: Math.round((healthStatus.metrics.memoryUsage.heapUsed / healthStatus.metrics.memoryUsage.heapTotal) * 100),
        },
        uptime: healthStatus.metrics.uptime,
      },
      queues: {
        faxProcessing: healthStatus.metrics.queueSizes.faxProcessing,
        emailToFax: healthStatus.metrics.queueSizes.emailToFax,
      },
      recentErrors: recentErrorsResult.rows.map(row => ({
        id: row.id,
        level: row.level,
        message: row.message,
        context: row.context,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    loggingService.error('Failed to fetch health status', error as Error);
    res.status(500).json({
      error: 'Failed to fetch health status',
      message: 'An error occurred while fetching system health status',
    });
  }
}

/**
 * GET /api/admin/dashboard/analytics/overview
 * Get analytics overview with user, fax job, order, and processing metrics
 */
export async function getAnalyticsOverview(req: Request, res: Response) {
  try {
    // Get user metrics
    const userStatsResult = await db.query(
      `SELECT 
         COUNT(*) as total_users
       FROM users`
    );

    const usersByRegionResult = await db.query(
      `SELECT region, COUNT(*) as count
       FROM user_insights
       WHERE region IS NOT NULL
       GROUP BY region
       ORDER BY count DESC`
    );

    const usersByAgeResult = await db.query(
      `SELECT age_range, COUNT(*) as count
       FROM user_insights
       WHERE age_range IS NOT NULL
       GROUP BY age_range
       ORDER BY age_range`
    );

    const usersByDigitalScoreResult = await db.query(
      `SELECT 
         CASE 
           WHEN digital_exclusion_score = 1 THEN 'Very Low (1)'
           WHEN digital_exclusion_score = 2 THEN 'Low (2)'
           WHEN digital_exclusion_score = 3 THEN 'Medium (3)'
           WHEN digital_exclusion_score = 4 THEN 'High (4)'
           WHEN digital_exclusion_score = 5 THEN 'Very High (5)'
         END as score_range,
         COUNT(*) as count
       FROM user_insights
       WHERE digital_exclusion_score IS NOT NULL
       GROUP BY digital_exclusion_score
       ORDER BY digital_exclusion_score`
    );

    // Get fax job metrics
    const faxJobStatsResult = await db.query(
      `SELECT 
         COUNT(*) as total_jobs,
         COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h_jobs
       FROM fax_jobs`
    );

    const faxJobsByStatusResult = await db.query(
      `SELECT status, COUNT(*) as count
       FROM fax_jobs
       GROUP BY status`
    );

    const faxJobsPerDayResult = await db.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as count
       FROM fax_jobs
       WHERE created_at > NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );

    // Get order metrics
    const orderStatsResult = await db.query(
      `SELECT 
         COUNT(*) as total_orders,
         SUM(total_amount) as total_revenue
       FROM orders`
    );

    const ordersByStatusResult = await db.query(
      `SELECT status, COUNT(*) as count
       FROM orders
       GROUP BY status`
    );

    // Get processing metrics
    const processingStatsResult = await db.query(
      `SELECT 
         AVG(accuracy) as avg_accuracy,
         AVG(confidence) as avg_confidence,
         AVG(processing_time_ms) as avg_processing_time
       FROM processing_metrics
       WHERE created_at > NOW() - INTERVAL '24 hours'`
    );

    // Format response
    const usersByRegion: Record<string, number> = {};
    usersByRegionResult.rows.forEach(row => {
      usersByRegion[row.region] = parseInt(row.count, 10);
    });

    const usersByAgeRange: Record<string, number> = {};
    usersByAgeResult.rows.forEach(row => {
      usersByAgeRange[row.age_range] = parseInt(row.count, 10);
    });

    const usersByDigitalScore: Record<string, number> = {};
    usersByDigitalScoreResult.rows.forEach(row => {
      usersByDigitalScore[row.score_range] = parseInt(row.count, 10);
    });

    const faxJobsByStatus: Record<string, number> = {};
    faxJobsByStatusResult.rows.forEach(row => {
      faxJobsByStatus[row.status] = parseInt(row.count, 10);
    });

    const ordersByStatus: Record<string, number> = {};
    ordersByStatusResult.rows.forEach(row => {
      ordersByStatus[row.status] = parseInt(row.count, 10);
    });

    res.json({
      users: {
        total: parseInt(userStatsResult.rows[0].total_users, 10),
        byRegion: usersByRegion,
        byAgeRange: usersByAgeRange,
        byDigitalScore: usersByDigitalScore,
      },
      faxJobs: {
        total: parseInt(faxJobStatsResult.rows[0].total_jobs, 10),
        last24Hours: parseInt(faxJobStatsResult.rows[0].last_24h_jobs, 10),
        byStatus: faxJobsByStatus,
        perDay: faxJobsPerDayResult.rows.map(row => ({
          date: row.date,
          count: parseInt(row.count, 10),
        })),
      },
      orders: {
        total: parseInt(orderStatsResult.rows[0].total_orders, 10) || 0,
        totalRevenue: parseFloat(orderStatsResult.rows[0].total_revenue) || 0,
        byStatus: ordersByStatus,
      },
      processing: {
        avgAccuracy: parseFloat(processingStatsResult.rows[0]?.avg_accuracy) || 0,
        avgConfidence: parseFloat(processingStatsResult.rows[0]?.avg_confidence) || 0,
        avgProcessingTime: parseFloat(processingStatsResult.rows[0]?.avg_processing_time) || 0,
      },
    });
  } catch (error) {
    loggingService.error('Failed to fetch analytics overview', error as Error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      message: 'An error occurred while fetching analytics overview',
    });
  }
}

/**
 * GET /api/admin/dashboard/audit/logs
 * Get audit logs with filtering
 */
export async function getAuditLogs(req: Request, res: Response) {
  try {
    const {
      eventType,
      startDate,
      endDate,
      limit = '100',
    } = req.query;

    const limitNum = parseInt(limit as string, 10);
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    // Build WHERE clause
    if (eventType) {
      conditions.push(`event_type = $${paramCount++}`);
      params.push(eventType);
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramCount++}`);
      params.push(new Date(startDate as string));
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramCount++}`);
      params.push(new Date(endDate as string));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get logs
    params.push(limitNum);
    const logsResult = await db.query(
      `SELECT 
         id,
         user_id,
         fax_job_id,
         event_type,
         event_data,
         created_at
       FROM audit_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount++}`,
      params
    );

    // Get available event types for filter dropdown
    const eventTypesResult = await db.query(
      `SELECT DISTINCT event_type
       FROM audit_logs
       ORDER BY event_type`
    );

    res.json({
      logs: logsResult.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        faxJobId: row.fax_job_id,
        eventType: row.event_type,
        eventData: row.event_data,
        createdAt: row.created_at,
      })),
      total,
      eventTypes: eventTypesResult.rows.map(row => row.event_type),
    });
  } catch (error) {
    loggingService.error('Failed to fetch audit logs', error as Error);
    res.status(500).json({
      error: 'Failed to fetch audit logs',
      message: 'An error occurred while fetching audit logs',
    });
  }
}
