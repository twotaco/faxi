import { Worker, Job, QueueEvents } from 'bullmq';
import { redis } from '../queue/connection';
import { FaxJobData } from '../queue/faxQueue';
import { faxJobRepository } from '../repositories/faxJobRepository';
import { auditLogService } from './auditLogService';
import { config } from '../config';

export interface FaxProcessorWorkerOptions {
  concurrency?: number;
  maxStalledCount?: number;
  stalledInterval?: number;
}

export class FaxProcessorWorker {
  private worker: Worker<FaxJobData>;
  private queueEvents: QueueEvents;
  private isShuttingDown = false;

  constructor(options: FaxProcessorWorkerOptions = {}) {
    const {
      concurrency = 1,
      maxStalledCount = 1,
      stalledInterval = 30000, // 30 seconds
    } = options;

    // Create the worker
    this.worker = new Worker<FaxJobData>(
      'fax-processing',
      this.processJob.bind(this),
      {
        connection: redis.getClient(),
        concurrency,
        maxStalledCount,
        stalledInterval,
        removeOnComplete: {
          count: 100,
          age: 24 * 3600, // 24 hours
        },
        removeOnFail: {
          count: 500,
          age: 7 * 24 * 3600, // 7 days
        },
      }
    );

    // Create queue events listener for monitoring
    this.queueEvents = new QueueEvents('fax-processing', {
      connection: redis.getClient(),
    });

    this.setupEventListeners();
  }

  /**
   * Main job processing function
   */
  private async processJob(job: Job<FaxJobData>): Promise<void> {
    const { data } = job;
    
    try {
      // Update job progress
      await job.updateProgress(0);
      
      // Log job start
      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: data.faxId,
        operation: 'processing_start',
        details: {
          fromNumber: data.fromNumber,
          toNumber: data.toNumber,
          pageCount: data.pageCount,
          jobId: job.id,
        },
      });

      // Update fax job status to processing
      await faxJobRepository.updateStatus(data.faxId, 'processing');
      await job.updateProgress(10);

      // Import the pipeline orchestrator (to avoid circular dependencies)
      const { FaxProcessingPipeline } = await import('./faxProcessingPipeline');
      const pipeline = new FaxProcessingPipeline();

      // Execute the processing pipeline
      const result = await pipeline.processFax(data, {
        onProgress: async (progress: number) => {
          await job.updateProgress(Math.min(progress, 90));
        },
      });

      // Update final progress
      await job.updateProgress(100);

      // Update fax job status based on result
      if (result.success) {
        await faxJobRepository.updateStatus(data.faxId, 'completed', {
          responseReferenceId: result.responseReferenceId,
          responseFaxId: result.responseFaxId,
        });
      } else {
        await faxJobRepository.updateStatus(data.faxId, 'failed', {
          errorMessage: result.errorMessage,
        });
      }

      // Log job completion
      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: data.faxId,
        operation: 'processing_complete',
        details: {
          success: result.success,
          responseReferenceId: result.responseReferenceId,
          responseFaxId: result.responseFaxId,
          errorMessage: result.errorMessage,
        },
      });

    } catch (error) {
      // Handle job failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('Fax processing job failed:', {
        faxId: data.faxId,
        jobId: job.id,
        error: errorMessage,
      });

      // Update fax job status to failed
      await faxJobRepository.updateStatus(data.faxId, 'failed', {
        errorMessage,
      });

      // Log job failure
      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: data.faxId,
        operation: 'processing_failed',
        details: {
          error: errorMessage,
          jobId: job.id,
        },
      });

      // Re-throw to trigger BullMQ retry logic
      throw error;
    }
  }

  /**
   * Setup event listeners for monitoring and logging
   */
  private setupEventListeners(): void {
    // Worker events
    this.worker.on('ready', () => {
      console.log('Fax processor worker is ready');
    });

    this.worker.on('error', (error) => {
      console.error('Fax processor worker error:', error);
    });

    this.worker.on('failed', async (job, error) => {
      if (job) {
        console.error('Job failed:', {
          jobId: job.id,
          faxId: job.data.faxId,
          error: error.message,
          attemptsMade: job.attemptsMade,
          attemptsTotal: job.opts.attempts,
        });

        // Log failed job
        await auditLogService.logOperation({
          entityType: 'fax_job',
          entityId: job.data.faxId,
          operation: 'job_failed',
          details: {
            jobId: job.id,
            error: error.message,
            attemptsMade: job.attemptsMade,
            attemptsTotal: job.opts.attempts,
          },
        });
      }
    });

    this.worker.on('completed', async (job) => {
      console.log('Job completed:', {
        jobId: job.id,
        faxId: job.data.faxId,
        processingTime: Date.now() - job.timestamp,
      });
    });

    this.worker.on('stalled', async (jobId) => {
      console.warn('Job stalled:', { jobId });
      
      // Log stalled job
      await auditLogService.logOperation({
        entityType: 'fax_job',
        entityId: jobId,
        operation: 'job_stalled',
        details: { jobId },
      });
    });

    // Queue events
    this.queueEvents.on('waiting', ({ jobId }) => {
      console.log('Job waiting:', { jobId });
    });

    this.queueEvents.on('active', ({ jobId }) => {
      console.log('Job active:', { jobId });
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      console.log('Job progress:', { jobId, progress: data });
    });
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    console.log('Starting fax processor worker...');
    
    // Worker starts automatically when created
    // Just log that we're ready
    await auditLogService.logOperation({
      entityType: 'system',
      entityId: 'fax_processor_worker',
      operation: 'worker_started',
      details: {
        concurrency: this.worker.opts.concurrency,
        maxStalledCount: this.worker.opts.maxStalledCount,
      },
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('Shutting down fax processor worker...');

    try {
      // Close the worker gracefully
      await this.worker.close();
      
      // Close queue events
      await this.queueEvents.close();

      console.log('Fax processor worker shut down successfully');

      // Log shutdown
      await auditLogService.logOperation({
        entityType: 'system',
        entityId: 'fax_processor_worker',
        operation: 'worker_shutdown',
        details: { graceful: true },
      });

    } catch (error) {
      console.error('Error during worker shutdown:', error);
      
      // Log shutdown error
      await auditLogService.logOperation({
        entityType: 'system',
        entityId: 'fax_processor_worker',
        operation: 'worker_shutdown_error',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Get worker status and metrics
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    isShuttingDown: boolean;
    concurrency: number;
    processing: number;
  }> {
    return {
      isRunning: !this.worker.closing,
      isShuttingDown: this.isShuttingDown,
      concurrency: this.worker.opts.concurrency || 1,
      processing: 0, // BullMQ doesn't expose running count directly
    };
  }

  /**
   * Pause the worker
   */
  async pause(): Promise<void> {
    await this.worker.pause();
    console.log('Fax processor worker paused');
  }

  /**
   * Resume the worker
   */
  async resume(): Promise<void> {
    this.worker.resume();
    console.log('Fax processor worker resumed');
  }

  /**
   * Get job counts and queue health
   */
  async getQueueHealth(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    // Import the queue directly since worker.queue is not accessible
    const { faxProcessingQueue } = await import('../queue/faxQueue');
    
    return {
      waiting: await faxProcessingQueue.getWaiting().then((jobs: any[]) => jobs.length),
      active: await faxProcessingQueue.getActive().then((jobs: any[]) => jobs.length),
      completed: await faxProcessingQueue.getCompleted().then((jobs: any[]) => jobs.length),
      failed: await faxProcessingQueue.getFailed().then((jobs: any[]) => jobs.length),
      delayed: await faxProcessingQueue.getDelayed().then((jobs: any[]) => jobs.length),
    };
  }
}

// Export singleton instance
export const faxProcessorWorker = new FaxProcessorWorker({
  concurrency: config.worker?.concurrency || 1,
  maxStalledCount: config.worker?.maxStalledCount || 1,
  stalledInterval: config.worker?.stalledInterval || 30000,
});