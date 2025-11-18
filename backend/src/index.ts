import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { db } from './database/connection';
import { redis } from './queue/connection';
import { s3Storage } from './storage/s3';
import { checkQueueHealth } from './queue/faxQueue';
import { telnyxWebhookController } from './webhooks/telnyxWebhookController';
import { stripeWebhookController } from './webhooks/stripeWebhookController';
import { emailWebhookController } from './webhooks/emailWebhookController';
import { testWebhookController } from './webhooks/testWebhookController';
import { emailToFaxWorker } from './services/emailToFaxWorker';
import { faxProcessorWorker } from './services/faxProcessorWorker';
import { monitoringService } from './services/monitoringService';
import { loggingService } from './services/loggingService';

const app = express();

// Monitoring and logging middleware (before other middleware)
app.use(loggingService.requestLogging());
app.use(monitoringService.requestMonitoring());

// Special middleware for Stripe webhooks (needs raw body)
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// Regular middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Enhanced health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = await monitoringService.getHealthStatus();
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    loggingService.error('Health check failed', error as Error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Prometheus metrics endpoint
app.get('/metrics', (req: Request, res: Response) => {
  try {
    const metrics = monitoringService.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    loggingService.error('Failed to generate metrics', error as Error);
    res.status(500).send('Failed to generate metrics');
  }
});

// Monitoring dashboard endpoints
app.get('/monitoring/logs', async (req: Request, res: Response) => {
  try {
    const level = req.query.level as 'error' | 'warn' | 'info' | 'debug' | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const userId = req.query.userId as string | undefined;
    const faxJobId = req.query.faxJobId as string | undefined;
    
    const logs = await loggingService.getRecentLogs(level, limit, { userId, faxJobId });
    res.json(logs);
  } catch (error) {
    loggingService.error('Failed to fetch logs', error as Error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.get('/monitoring/stats', async (req: Request, res: Response) => {
  try {
    const start = req.query.start ? new Date(req.query.start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = req.query.end ? new Date(req.query.end as string) : new Date();
    
    const stats = await loggingService.getLogStatistics({ start, end });
    res.json(stats);
  } catch (error) {
    loggingService.error('Failed to fetch log statistics', error as Error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Backup and disaster recovery endpoints (admin only in production)
app.post('/admin/backup/create', async (req: Request, res: Response) => {
  try {
    const { type } = req.body;
    const { backupService } = await import('./services/backupService');
    
    let backup;
    switch (type) {
      case 'database':
        backup = await backupService.createDatabaseBackup();
        break;
      case 'full':
        backup = await backupService.createFullBackup();
        break;
      default:
        return res.status(400).json({ error: 'Invalid backup type' });
    }
    
    res.json(backup);
  } catch (error) {
    loggingService.error('Backup creation failed', error as Error);
    res.status(500).json({ error: 'Backup creation failed' });
  }
});

app.get('/admin/backup/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { backupService } = await import('./services/backupService');
    
    const history = backupService.getBackupHistory(limit);
    res.json(history);
  } catch (error) {
    loggingService.error('Failed to fetch backup history', error as Error);
    res.status(500).json({ error: 'Failed to fetch backup history' });
  }
});

app.post('/admin/backup/test/:backupId', async (req: Request, res: Response) => {
  try {
    const { backupId } = req.params;
    const { backupService } = await import('./services/backupService');
    
    const isValid = await backupService.testBackupIntegrity(backupId);
    res.json({ backupId, valid: isValid });
  } catch (error) {
    loggingService.error('Backup integrity test failed', error as Error);
    res.status(500).json({ error: 'Backup integrity test failed' });
  }
});

app.post('/admin/disaster-recovery/execute/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { dryRun } = req.body;
    const { backupService } = await import('./services/backupService');
    
    await backupService.executeDisasterRecoveryPlan(planId, dryRun);
    res.json({ success: true, planId, dryRun });
  } catch (error) {
    loggingService.error('Disaster recovery execution failed', error as Error);
    res.status(500).json({ error: 'Disaster recovery execution failed' });
  }
});

app.get('/admin/disaster-recovery/plans', async (req: Request, res: Response) => {
  try {
    const { backupService } = await import('./services/backupService');
    
    const plans = backupService.getDisasterRecoveryPlans();
    res.json(plans);
  } catch (error) {
    loggingService.error('Failed to fetch disaster recovery plans', error as Error);
    res.status(500).json({ error: 'Failed to fetch disaster recovery plans' });
  }
});

// Admin Authentication Endpoints
import { adminAuthService } from './services/adminAuthService';
import { adminUserRepository } from './repositories/adminUserRepository';
import { loginRateLimiter } from './middleware/rateLimiter';
import { auditLogService } from './services/auditLogService';

// Admin login endpoint with rate limiting
app.post('/admin/auth/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required',
      });
    }

    // Find user with password hash
    const user = await adminUserRepository.findByEmailWithPassword(email);

    if (!user) {
      // Don't reveal if user exists
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      await auditLogService.log({
        eventType: 'admin.login_failed',
        eventData: {
          email,
          reason: 'account_inactive',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        },
      });

      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
    }

    // Verify password
    const isValidPassword = await adminAuthService.verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      await auditLogService.log({
        eventType: 'admin.login_failed',
        eventData: {
          email,
          reason: 'invalid_password',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        },
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password',
      });
    }

    // Generate tokens
    const { accessToken, refreshTokenId, expiresAt } = await adminAuthService.generateTokens(user);

    // Store refresh token in database
    await adminUserRepository.createRefreshToken(user.id, refreshTokenId, expiresAt);

    // Update last login time
    await adminUserRepository.update(user.id, { lastLoginAt: new Date() });

    // Log successful login
    await auditLogService.log({
      userId: user.id,
      eventType: 'admin.login_success',
      eventData: {
        email: user.email,
        role: user.role,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      },
    });

    // Set refresh token as httpOnly cookie
    res.cookie('admin_refresh_token', refreshTokenId, {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/admin/auth',
    });

    // Return access token and user info
    res.json({
      accessToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    loggingService.error('Admin login error', error as Error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login. Please try again.',
    });
  }
});

// Admin logout endpoint
app.post('/admin/auth/logout', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.admin_refresh_token;

    if (refreshToken) {
      // Revoke the refresh token
      await adminUserRepository.revokeRefreshToken(refreshToken);

      // Log logout
      const token = await adminUserRepository.findRefreshToken(refreshToken);
      if (token) {
        await auditLogService.log({
          userId: token.adminUserId,
          eventType: 'admin.logout',
          eventData: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Clear the cookie
    res.clearCookie('admin_refresh_token', {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'strict',
      path: '/admin/auth',
    });

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    loggingService.error('Admin logout error', error as Error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'An error occurred during logout.',
    });
  }
});

// Admin refresh token endpoint
app.post('/admin/auth/refresh', async (req: Request, res: Response) => {
  try {
    const refreshTokenId = req.cookies.admin_refresh_token;

    if (!refreshTokenId) {
      return res.status(401).json({
        error: 'No refresh token',
        message: 'Refresh token not found. Please login again.',
      });
    }

    // Find and validate refresh token
    const refreshToken = await adminUserRepository.findRefreshToken(refreshTokenId);

    if (!refreshToken) {
      res.clearCookie('admin_refresh_token', {
        httpOnly: true,
        secure: config.app.env === 'production',
        sameSite: 'strict',
        path: '/admin/auth',
      });

      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'Refresh token is invalid or expired. Please login again.',
      });
    }

    // Get user
    const user = await adminUserRepository.findById(refreshToken.adminUserId);

    if (!user || !user.isActive) {
      await adminUserRepository.revokeRefreshToken(refreshTokenId);
      res.clearCookie('admin_refresh_token', {
        httpOnly: true,
        secure: config.app.env === 'production',
        sameSite: 'strict',
        path: '/admin/auth',
      });

      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated.',
      });
    }

    // Revoke old refresh token
    await adminUserRepository.revokeRefreshToken(refreshTokenId);

    // Generate new tokens (token rotation)
    const { accessToken, refreshTokenId: newRefreshTokenId, expiresAt } = 
      await adminAuthService.generateTokens(user);

    // Store new refresh token
    await adminUserRepository.createRefreshToken(user.id, newRefreshTokenId, expiresAt);

    // Set new refresh token cookie
    res.cookie('admin_refresh_token', newRefreshTokenId, {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/admin/auth',
    });

    // Return new access token
    res.json({
      accessToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    loggingService.error('Admin token refresh error', error as Error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'An error occurred while refreshing token.',
    });
  }
});

// Admin Dashboard Endpoints
import { requireAdminAuth, requirePermission } from './middleware/adminAuth';
import { faxJobRepository } from './repositories/faxJobRepository';

// Dashboard metrics endpoint
app.get('/admin/dashboard/metrics', requireAdminAuth, requirePermission('dashboard:view'), async (req: Request, res: Response) => {
  try {
    // Get system health status from monitoring service
    const healthStatus = await monitoringService.getHealthStatus();

    // Get active jobs count
    const activeJobsResult = await db.query(
      `SELECT COUNT(*) as count FROM fax_jobs WHERE status IN ('pending', 'processing')`
    );
    const activeJobsCount = parseInt(activeJobsResult.rows[0].count, 10);

    // Get recent jobs (last 10)
    const recentJobsResult = await db.query(
      `SELECT id, reference_id as "referenceId", user_id as "userId", direction, 
              from_number as "fromNumber", to_number as "toNumber", status, 
              created_at as "createdAt", updated_at as "updatedAt"
       FROM fax_jobs 
       ORDER BY created_at DESC 
       LIMIT 10`
    );

    // Get error rate from audit logs (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const errorLogsResult = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE event_type LIKE '%.error' OR event_type LIKE '%.failed' 
       AND created_at > $1`,
      [oneHourAgo]
    );
    const errorCount = parseInt(errorLogsResult.rows[0].count, 10);

    // Get total requests in last hour (from monitoring service metrics)
    const totalLogsResult = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs WHERE created_at > $1`,
      [oneHourAgo]
    );
    const totalCount = parseInt(totalLogsResult.rows[0].count, 10);
    const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0;

    // Get processing time stats (last 100 completed jobs)
    const processingTimeResult = await db.query(
      `SELECT 
         EXTRACT(EPOCH FROM (completed_at - created_at)) as duration
       FROM fax_jobs 
       WHERE status = 'completed' AND completed_at IS NOT NULL
       ORDER BY completed_at DESC 
       LIMIT 100`
    );

    const durations = processingTimeResult.rows.map(row => parseFloat(row.duration));
    const avgProcessingTime = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;

    // Calculate percentiles
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)] || 0;
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0;
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0;

    // Compile dashboard metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      health: {
        status: healthStatus.status,
        services: healthStatus.services,
      },
      system: {
        uptime: healthStatus.metrics.uptime,
        memoryUsage: {
          used: healthStatus.metrics.memoryUsage.heapUsed,
          total: healthStatus.metrics.memoryUsage.heapTotal,
          percentage: (healthStatus.metrics.memoryUsage.heapUsed / healthStatus.metrics.memoryUsage.heapTotal) * 100,
        },
        activeConnections: healthStatus.metrics.activeConnections,
      },
      jobs: {
        active: activeJobsCount,
        recent: recentJobsResult.rows,
      },
      queue: {
        faxProcessing: healthStatus.metrics.queueSizes.faxProcessing,
        emailToFax: healthStatus.metrics.queueSizes.emailToFax,
        total: healthStatus.metrics.queueSizes.faxProcessing + healthStatus.metrics.queueSizes.emailToFax,
      },
      errors: {
        count: errorCount,
        rate: errorRate,
        period: '1h',
      },
      performance: {
        avgProcessingTime,
        percentiles: {
          p50,
          p95,
          p99,
        },
        sampleSize: durations.length,
      },
    };

    res.json(metrics);
  } catch (error) {
    loggingService.error('Failed to fetch dashboard metrics', error as Error);
    res.status(500).json({
      error: 'Failed to fetch metrics',
      message: 'An error occurred while fetching dashboard metrics',
    });
  }
});

// Dashboard real-time stream (SSE)
app.get('/admin/dashboard/stream', requireAdminAuth, requirePermission('dashboard:view'), async (req: Request, res: Response) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Function to send metrics
  const sendMetrics = async () => {
    try {
      const healthStatus = await monitoringService.getHealthStatus();

      // Get active jobs count
      const activeJobsResult = await db.query(
        `SELECT COUNT(*) as count FROM fax_jobs WHERE status IN ('pending', 'processing')`
      );
      const activeJobsCount = parseInt(activeJobsResult.rows[0].count, 10);

      // Get error rate
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const errorLogsResult = await db.query(
        `SELECT COUNT(*) as count FROM audit_logs 
         WHERE (event_type LIKE '%.error' OR event_type LIKE '%.failed') 
         AND created_at > $1`,
        [oneHourAgo]
      );
      const errorCount = parseInt(errorLogsResult.rows[0].count, 10);

      const metrics = {
        type: 'metrics',
        timestamp: new Date().toISOString(),
        data: {
          health: healthStatus.status,
          services: healthStatus.services,
          activeJobs: activeJobsCount,
          queueSize: healthStatus.metrics.queueSizes.faxProcessing + healthStatus.metrics.queueSizes.emailToFax,
          errorCount,
          memoryUsage: Math.round((healthStatus.metrics.memoryUsage.heapUsed / healthStatus.metrics.memoryUsage.heapTotal) * 100),
        },
      };

      res.write(`data: ${JSON.stringify(metrics)}\n\n`);
    } catch (error) {
      console.error('Error sending metrics:', error);
    }
  };

  // Send metrics every 5 seconds
  const metricsInterval = setInterval(sendMetrics, 5000);

  // Send initial metrics immediately
  await sendMetrics();

  // Listen for alerts from alerting service
  const alertListener = (alert: any) => {
    try {
      const alertEvent = {
        type: 'alert',
        timestamp: new Date().toISOString(),
        data: alert,
      };
      res.write(`data: ${JSON.stringify(alertEvent)}\n\n`);
    } catch (error) {
      console.error('Error sending alert:', error);
    }
  };

  // Note: In a production system, you'd subscribe to an event emitter
  // For now, we'll just send metrics periodically

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(metricsInterval);
    res.end();
  });
});

// Fax job management endpoints

// List fax jobs with filtering and pagination
app.get('/admin/jobs', requireAdminAuth, requirePermission('jobs:view'), async (req: Request, res: Response) => {
  try {
    const {
      status,
      user,
      intent,
      from,
      to,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build query
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      conditions.push(`status = $${paramCount++}`);
      params.push(status);
    }

    if (user) {
      conditions.push(`user_id = $${paramCount++}`);
      params.push(user);
    }

    if (intent) {
      conditions.push(`interpretation_result->>'intent' = $${paramCount++}`);
      params.push(intent);
    }

    if (from) {
      conditions.push(`created_at >= $${paramCount++}`);
      params.push(new Date(from as string));
    }

    if (to) {
      conditions.push(`created_at <= $${paramCount++}`);
      params.push(new Date(to as string));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM fax_jobs ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Get jobs
    params.push(limitNum, offset);
    const jobsResult = await db.query(
      `SELECT 
         id, fax_id as "faxId", reference_id as "referenceId", 
         user_id as "userId", direction, from_number as "fromNumber", 
         to_number as "toNumber", status, page_count as "pageCount",
         media_url as "mediaUrl", storage_key as "storageKey",
         interpretation_result as "interpretationResult",
         error_message as "errorMessage",
         created_at as "createdAt", updated_at as "updatedAt",
         completed_at as "completedAt"
       FROM fax_jobs 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );

    res.json({
      jobs: jobsResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    loggingService.error('Failed to fetch fax jobs', error as Error);
    res.status(500).json({
      error: 'Failed to fetch jobs',
      message: 'An error occurred while fetching fax jobs',
    });
  }
});

// Get single fax job details
app.get('/admin/jobs/:id', requireAdminAuth, requirePermission('jobs:view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await faxJobRepository.findById(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Fax job with ID ${id} not found`,
      });
    }

    // Get audit logs for this job
    const auditLogs = await db.query(
      `SELECT id, user_id as "userId", event_type as "eventType", 
              event_data as "eventData", created_at as "createdAt"
       FROM audit_logs 
       WHERE fax_job_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [id]
    );

    // Log the view action
    await auditLogService.log({
      userId: req.adminUser?.id,
      faxJobId: id,
      eventType: 'admin.job_viewed',
      eventData: {
        adminEmail: req.adminUser?.email,
        jobId: id,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      job,
      auditLogs: auditLogs.rows,
    });
  } catch (error) {
    loggingService.error('Failed to fetch fax job details', error as Error);
    res.status(500).json({
      error: 'Failed to fetch job',
      message: 'An error occurred while fetching fax job details',
    });
  }
});

// Retry failed fax job
app.post('/admin/jobs/:id/retry', requireAdminAuth, requirePermission('jobs:retry'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await faxJobRepository.findById(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Fax job with ID ${id} not found`,
      });
    }

    if (job.status !== 'failed') {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Only failed jobs can be retried',
        currentStatus: job.status,
      });
    }

    // Update job status to pending
    await faxJobRepository.update(id, {
      status: 'pending',
      errorMessage: null,
    });

    // Re-enqueue the job
    const { faxQueue } = await import('./queue/faxQueue');
    await faxQueue.add('process-fax', {
      faxJobId: id,
      faxId: job.faxId,
      userId: job.userId,
    });

    // Log the retry action
    await auditLogService.log({
      userId: req.adminUser?.id,
      faxJobId: id,
      eventType: 'admin.job_retried',
      eventData: {
        adminEmail: req.adminUser?.email,
        adminRole: req.adminUser?.role,
        jobId: id,
        previousStatus: 'failed',
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      message: 'Job retry initiated',
      jobId: id,
      status: 'pending',
    });
  } catch (error) {
    loggingService.error('Failed to retry fax job', error as Error);
    res.status(500).json({
      error: 'Failed to retry job',
      message: 'An error occurred while retrying the fax job',
    });
  }
});

// Cancel pending/processing fax job
app.post('/admin/jobs/:id/cancel', requireAdminAuth, requirePermission('jobs:cancel'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await faxJobRepository.findById(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Fax job with ID ${id} not found`,
      });
    }

    if (!['pending', 'processing'].includes(job.status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Only pending or processing jobs can be cancelled',
        currentStatus: job.status,
      });
    }

    // Update job status to failed with cancellation message
    await faxJobRepository.update(id, {
      status: 'failed',
      errorMessage: `Cancelled by admin: ${req.adminUser?.email}`,
      completedAt: new Date(),
    });

    // Log the cancel action
    await auditLogService.log({
      userId: req.adminUser?.id,
      faxJobId: id,
      eventType: 'admin.job_cancelled',
      eventData: {
        adminEmail: req.adminUser?.email,
        adminRole: req.adminUser?.role,
        jobId: id,
        previousStatus: job.status,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      message: 'Job cancelled successfully',
      jobId: id,
      status: 'failed',
    });
  } catch (error) {
    loggingService.error('Failed to cancel fax job', error as Error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: 'An error occurred while cancelling the fax job',
    });
  }
});

// User Management Endpoints
import { userRepository } from './repositories/userRepository';
import { conversationContextRepository } from './repositories/conversationContextRepository';
import { orderRepository } from './repositories/orderRepository';

// List users with search and pagination
app.get('/admin/users', requireAdminAuth, requirePermission('users:view'), async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = 'SELECT * FROM users';
    const params: any[] = [];
    
    if (search) {
      query += ' WHERE phone_number LIKE $1 OR email_address LIKE $1 OR name LIKE $1';
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offset);

    const result = await db.query(query, params);
    
    const countQuery = search 
      ? 'SELECT COUNT(*) as count FROM users WHERE phone_number LIKE $1 OR email_address LIKE $1 OR name LIKE $1'
      : 'SELECT COUNT(*) as count FROM users';
    const countResult = await db.query(countQuery, search ? [`%${search}%`] : []);
    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
      users: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    loggingService.error('Failed to fetch users', error as Error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
app.get('/admin/users/:id', requireAdminAuth, requirePermission('users:view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await userRepository.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    loggingService.error('Failed to fetch user', error as Error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get user activity
app.get('/admin/users/:id/activity', requireAdminAuth, requirePermission('users:view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50' } = req.query;
    
    const logs = await db.query(
      `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [id, parseInt(limit as string, 10)]
    );

    res.json({ activity: logs.rows });
  } catch (error) {
    loggingService.error('Failed to fetch user activity', error as Error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Get user orders
app.get('/admin/users/:id/orders', requireAdminAuth, requirePermission('users:view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orders = await orderRepository.findByUserId(id);
    res.json({ orders });
  } catch (error) {
    loggingService.error('Failed to fetch user orders', error as Error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Delete user context
app.delete('/admin/users/:id/contexts/:contextId', requireAdminAuth, requirePermission('users:edit'), async (req: Request, res: Response) => {
  try {
    const { id, contextId } = req.params;
    await conversationContextRepository.delete(contextId);
    
    await auditLogService.log({
      userId: req.adminUser?.id,
      eventType: 'admin.context_deleted',
      eventData: {
        adminEmail: req.adminUser?.email,
        userId: id,
        contextId,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ message: 'Context deleted successfully' });
  } catch (error) {
    loggingService.error('Failed to delete context', error as Error);
    res.status(500).json({ error: 'Failed to delete context' });
  }
});

// MCP Monitoring Endpoints
import { mcpMonitoringService } from './services/mcpMonitoringService';

app.get('/admin/mcp/servers', requireAdminAuth, requirePermission('mcp:view'), async (req: Request, res: Response) => {
  try {
    const servers = await mcpMonitoringService.getServerStats();
    res.json({ servers });
  } catch (error) {
    loggingService.error('Failed to fetch MCP servers', error as Error);
    res.status(500).json({ error: 'Failed to fetch MCP servers' });
  }
});

app.get('/admin/mcp/external-apis', requireAdminAuth, requirePermission('mcp:view'), async (req: Request, res: Response) => {
  try {
    const apis = await mcpMonitoringService.getExternalAPIHealth();
    res.json({ apis });
  } catch (error) {
    loggingService.error('Failed to fetch external APIs', error as Error);
    res.status(500).json({ error: 'Failed to fetch external APIs' });
  }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Faxi Core System',
    version: '1.0.0',
    status: 'running',
  });
});

// Webhook endpoints
app.post('/webhooks/telnyx/fax/received', (req: Request, res: Response) => {
  telnyxWebhookController.handleFaxReceived(req, res);
});

app.post('/webhooks/stripe', (req: Request, res: Response) => {
  stripeWebhookController.handleWebhook(req, res);
});

app.post('/webhooks/email/received', (req: Request, res: Response) => {
  emailWebhookController.handleEmailReceived(req, res);
});

// Test endpoints (only available in test mode)
if (config.app.testMode) {
  app.post('/test/fax/receive', (req: Request, res: Response) => {
    testWebhookController.handleTestFaxReceive(req, res);
  });

  app.get('/test/fax/media/:fax_id', (req: Request, res: Response) => {
    testWebhookController.serveTestFaxMedia(req, res);
  });

  app.get('/test/fax/status/:fax_id', (req: Request, res: Response) => {
    testWebhookController.getTestFaxStatus(req, res);
  });

  app.get('/test/fax/list', (req: Request, res: Response) => {
    testWebhookController.listTestFaxes(req, res);
  });

  app.delete('/test/fax/clear', (req: Request, res: Response) => {
    testWebhookController.clearTestData(req, res);
  });

  app.get('/test/fax/responses', (req: Request, res: Response) => {
    testWebhookController.getMockSentFaxes(req, res);
  });

  app.get('/test/fax/download/:fax_id', (req: Request, res: Response) => {
    testWebhookController.downloadMockFax(req, res);
  });

  app.get('/test/fax/stats', (req: Request, res: Response) => {
    testWebhookController.getMockFaxStats(req, res);
  });

  app.get('/test/fax/fixtures', (req: Request, res: Response) => {
    testWebhookController.listTestFixtures(req, res);
  });

  app.get('/test/fax/fixtures/:filename', (req: Request, res: Response) => {
    testWebhookController.serveTestFixture(req, res);
  });

  app.post('/test/fax/fixtures/generate', (req: Request, res: Response) => {
    testWebhookController.generateTestFixtures(req, res);
  });

  // Serve test UI
  app.get('/test', (req: Request, res: Response) => {
    res.sendFile('test/testUI.html', { root: __dirname });
  });
}

// Start server
async function start() {
  try {
    loggingService.info('Starting Faxi Core System', {}, {
      environment: config.app.env,
      testMode: config.app.testMode,
      port: config.app.port,
    });

    // Test database connection
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    loggingService.info('Database connected successfully');
    console.log('✓ Database connected');

    // Test Redis connection
    const redisHealthy = await redis.healthCheck();
    if (!redisHealthy) {
      throw new Error('Redis connection failed');
    }
    loggingService.info('Redis connected successfully');
    console.log('✓ Redis connected');

    // Test S3 connection
    const s3Healthy = await s3Storage.healthCheck();
    if (!s3Healthy) {
      loggingService.warn('S3 connection check failed (may need bucket setup)');
      console.warn('⚠ S3 connection check failed (may need bucket setup)');
    } else {
      loggingService.info('S3 connected successfully');
      console.log('✓ S3 connected');
    }

    // Start email-to-fax worker
    emailToFaxWorker.start();
    loggingService.info('Email-to-fax worker started');
    console.log('✓ Email-to-fax worker started');

    // Start fax processor worker
    await faxProcessorWorker.start();
    loggingService.info('Fax processor worker started');
    console.log('✓ Fax processor worker started');

    // Start server
    app.listen(config.app.port, () => {
      loggingService.info('Server started successfully', {}, {
        port: config.app.port,
        environment: config.app.env,
        testMode: config.app.testMode,
      });
      console.log(`✓ Server running on port ${config.app.port}`);
      console.log(`  Environment: ${config.app.env}`);
      console.log(`  Test mode: ${config.app.testMode}`);
    });
  } catch (error) {
    loggingService.error('Failed to start server', error as Error);
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  loggingService.info('SIGTERM received, shutting down gracefully...');
  console.log('SIGTERM received, shutting down gracefully...');
  
  try {
    await emailToFaxWorker.stop();
    await faxProcessorWorker.shutdown();
    await db.close();
    await redis.close();
    loggingService.info('Graceful shutdown completed');
  } catch (error) {
    loggingService.error('Error during graceful shutdown', error as Error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  loggingService.info('SIGINT received, shutting down gracefully...');
  console.log('SIGINT received, shutting down gracefully...');
  
  try {
    await emailToFaxWorker.stop();
    await faxProcessorWorker.shutdown();
    await db.close();
    await redis.close();
    loggingService.info('Graceful shutdown completed');
  } catch (error) {
    loggingService.error('Error during graceful shutdown', error as Error);
  }
  
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  loggingService.error('Uncaught exception', error);
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  loggingService.error('Unhandled promise rejection', reason as Error, {}, {
    promise: promise.toString(),
  });
  console.error('Unhandled promise rejection:', reason);
});

// Start the application
start();

export { app };
