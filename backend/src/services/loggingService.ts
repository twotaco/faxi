import { createLogger, format, transports, Logger } from 'winston';
import { config } from '../config';
import { db } from '../database/connection';

interface LogContext {
  userId?: string;
  faxJobId?: string;
  requestId?: string;
  sessionId?: string;
  correlationId?: string;
  [key: string]: any;
}

interface StructuredLog {
  level: string;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  performance?: {
    duration: number;
    operation: string;
  };
  metadata?: Record<string, any>;
}

class LoggingService {
  private static instance: LoggingService;
  private logger: Logger;
  private logBuffer: StructuredLog[] = [];
  private readonly maxBufferSize = 1000;

  private constructor() {
    this.logger = this.createLogger();
    this.startLogFlushing();
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  /**
   * Log an info message
   */
  public info(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('info', message, context, metadata);
  }

  /**
   * Log a warning message
   */
  public warn(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('warn', message, context, metadata);
  }

  /**
   * Log an error message
   */
  public error(message: string, error?: Error, context?: LogContext, metadata?: Record<string, any>): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined;

    this.log('error', message, context, metadata, errorData);
  }

  /**
   * Log a debug message
   */
  public debug(message: string, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('debug', message, context, metadata);
  }

  /**
   * Log performance metrics
   */
  public performance(operation: string, duration: number, context?: LogContext, metadata?: Record<string, any>): void {
    this.log('info', `Performance: ${operation}`, context, metadata, undefined, { duration, operation });
  }

  /**
   * Log fax processing events
   */
  public faxProcessing(
    event: 'received' | 'processing' | 'completed' | 'failed',
    faxJobId: string,
    context?: LogContext,
    metadata?: Record<string, any>
  ): void {
    this.log('info', `Fax ${event}: ${faxJobId}`, { ...context, faxJobId }, metadata);
  }

  /**
   * Log email events
   */
  public emailEvent(
    event: 'sent' | 'received' | 'failed',
    emailId: string,
    context?: LogContext,
    metadata?: Record<string, any>
  ): void {
    this.log('info', `Email ${event}: ${emailId}`, context, { ...metadata, emailId });
  }

  /**
   * Log payment events
   */
  public paymentEvent(
    event: 'initiated' | 'completed' | 'failed' | 'refunded',
    paymentId: string,
    amount?: number,
    context?: LogContext,
    metadata?: Record<string, any>
  ): void {
    this.log('info', `Payment ${event}: ${paymentId}`, context, { 
      ...metadata, 
      paymentId, 
      amount 
    });
  }

  /**
   * Log API calls to external services
   */
  public apiCall(
    service: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: LogContext,
    metadata?: Record<string, any>
  ): void {
    const level = statusCode >= 400 ? 'error' : 'info';
    this.log(level, `API Call: ${service} ${method} ${endpoint}`, context, {
      ...metadata,
      service,
      endpoint,
      method,
      statusCode,
      duration,
    });
  }

  /**
   * Log security events
   */
  public security(
    event: 'authentication' | 'authorization' | 'suspicious_activity' | 'webhook_verification',
    details: string,
    context?: LogContext,
    metadata?: Record<string, any>
  ): void {
    this.log('warn', `Security: ${event} - ${details}`, context, { ...metadata, securityEvent: event });
  }

  /**
   * Get recent logs for monitoring dashboard
   */
  public async getRecentLogs(
    level?: 'error' | 'warn' | 'info' | 'debug',
    limit: number = 100,
    context?: Partial<LogContext>
  ): Promise<StructuredLog[]> {
    try {
      let query = `
        SELECT level, message, context, metadata, error_data, performance_data, created_at
        FROM application_logs 
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (level) {
        query += ` AND level = $${paramIndex}`;
        params.push(level);
        paramIndex++;
      }

      if (context?.userId) {
        query += ` AND context->>'userId' = $${paramIndex}`;
        params.push(context.userId);
        paramIndex++;
      }

      if (context?.faxJobId) {
        query += ` AND context->>'faxJobId' = $${paramIndex}`;
        params.push(context.faxJobId);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await db.query(query, params);
      
      return result.rows.map(row => ({
        level: row.level,
        message: row.message,
        timestamp: row.created_at.toISOString(),
        context: row.context,
        metadata: row.metadata,
        error: row.error_data,
        performance: row.performance_data,
      }));
    } catch (error) {
      console.error('Failed to fetch logs from database:', error);
      return this.logBuffer.slice(-limit);
    }
  }

  /**
   * Get log statistics for monitoring
   */
  public async getLogStatistics(timeRange: { start: Date; end: Date }): Promise<{
    totalLogs: number;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    debugCount: number;
    topErrors: Array<{ message: string; count: number }>;
    logsByHour: Array<{ hour: string; count: number }>;
  }> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_logs,
          COUNT(*) FILTER (WHERE level = 'error') as error_count,
          COUNT(*) FILTER (WHERE level = 'warn') as warn_count,
          COUNT(*) FILTER (WHERE level = 'info') as info_count,
          COUNT(*) FILTER (WHERE level = 'debug') as debug_count
        FROM application_logs 
        WHERE created_at BETWEEN $1 AND $2
      `;

      const topErrorsQuery = `
        SELECT message, COUNT(*) as count
        FROM application_logs 
        WHERE level = 'error' AND created_at BETWEEN $1 AND $2
        GROUP BY message
        ORDER BY count DESC
        LIMIT 10
      `;

      const logsByHourQuery = `
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as count
        FROM application_logs 
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY hour
        ORDER BY hour
      `;

      const [statsResult, topErrorsResult, logsByHourResult] = await Promise.all([
        db.query(statsQuery, [timeRange.start, timeRange.end]),
        db.query(topErrorsQuery, [timeRange.start, timeRange.end]),
        db.query(logsByHourQuery, [timeRange.start, timeRange.end]),
      ]);

      const stats = statsResult.rows[0];
      
      return {
        totalLogs: parseInt(stats.total_logs),
        errorCount: parseInt(stats.error_count),
        warnCount: parseInt(stats.warn_count),
        infoCount: parseInt(stats.info_count),
        debugCount: parseInt(stats.debug_count),
        topErrors: topErrorsResult.rows.map(row => ({
          message: row.message,
          count: parseInt(row.count),
        })),
        logsByHour: logsByHourResult.rows.map(row => ({
          hour: row.hour.toISOString(),
          count: parseInt(row.count),
        })),
      };
    } catch (error) {
      console.error('Failed to get log statistics:', error);
      return {
        totalLogs: 0,
        errorCount: 0,
        warnCount: 0,
        infoCount: 0,
        debugCount: 0,
        topErrors: [],
        logsByHour: [],
      };
    }
  }

  /**
   * Create correlation ID for request tracing
   */
  public createCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Express middleware for request logging
   */
  public requestLogging() {
    return (req: any, res: any, next: any) => {
      const correlationId = this.createCorrelationId();
      const startTime = Date.now();
      
      req.correlationId = correlationId;
      res.setHeader('X-Correlation-ID', correlationId);

      this.info('Request started', {
        correlationId,
        requestId: correlationId,
      }, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      const originalEnd = res.end;
      res.end = function(this: any, ...args: any[]) {
        const duration = Date.now() - startTime;
        const logging = LoggingService.getInstance();
        
        logging.info('Request completed', {
          correlationId,
          requestId: correlationId,
        }, {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
        });

        if (res.statusCode >= 400) {
          logging.warn('Request failed', {
            correlationId,
            requestId: correlationId,
          }, {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
          });
        }

        originalEnd.apply(this, args);
      };

      next();
    };
  }

  private log(
    level: string,
    message: string,
    context?: LogContext,
    metadata?: Record<string, any>,
    error?: { name: string; message: string; stack?: string },
    performance?: { duration: number; operation: string }
  ): void {
    const structuredLog: StructuredLog = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      metadata,
      error,
      performance,
    };

    // Log to Winston (console, files, etc.)
    this.logger.log(level, message, structuredLog);

    // Add to buffer for database storage
    this.logBuffer.push(structuredLog);
    
    // Prevent buffer overflow
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  private createLogger(): Logger {
    const logFormat = format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.json(),
      format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          ...meta,
        });
      })
    );

    const logger = createLogger({
      level: config.app.logLevel || 'info',
      format: logFormat,
      defaultMeta: { service: 'faxi-core' },
      transports: [
        // Console transport for development
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          ),
        }),
        
        // File transport for all logs
        new transports.File({
          filename: 'logs/app.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
        
        // Separate file for errors
        new transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
      ],
    });

    // Add production transports
    if (config.app.environment === 'production') {
      // In production, you might add:
      // - Elasticsearch transport
      // - CloudWatch transport
      // - Syslog transport
      // - etc.
    }

    return logger;
  }

  private startLogFlushing(): void {
    // Flush logs to database every 10 seconds
    setInterval(async () => {
      if (this.logBuffer.length === 0) return;

      const logsToFlush = [...this.logBuffer];
      this.logBuffer = [];

      try {
        await this.flushLogsToDatabase(logsToFlush);
      } catch (error) {
        console.error('Failed to flush logs to database:', error);
        // Put logs back in buffer if flush failed
        this.logBuffer.unshift(...logsToFlush);
      }
    }, 10000);
  }

  private async flushLogsToDatabase(logs: StructuredLog[]): Promise<void> {
    if (logs.length === 0) return;

    const query = `
      INSERT INTO application_logs (
        level, message, context, metadata, error_data, performance_data, created_at
      ) VALUES ${logs.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(', ')}
    `;

    const params: any[] = [];
    for (const log of logs) {
      params.push(
        log.level,
        log.message,
        JSON.stringify(log.context || {}),
        JSON.stringify(log.metadata || {}),
        JSON.stringify(log.error || null),
        JSON.stringify(log.performance || null),
        new Date(log.timestamp)
      );
    }

    await db.query(query, params);
  }
}

export const loggingService = LoggingService.getInstance();