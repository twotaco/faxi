import { Queue, QueueOptions } from 'bullmq';
import { redis } from './connection';

export interface FaxJobData {
  faxId: string;
  faxJobId: string; // Internal database UUID
  fromNumber: string;
  toNumber: string;
  mediaUrl: string;
  pageCount: number;
  receivedAt: string;
  webhookPayload: any;
}

export interface EmailToFaxJobData {
  to: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
}

const queueOptions: QueueOptions = {
  connection: redis.getClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 500,
      age: 7 * 24 * 3600, // 7 days
    },
  },
};

// Queue for processing incoming faxes
export const faxProcessingQueue = new Queue<FaxJobData>(
  'fax-processing',
  queueOptions
);

// Queue for email-to-fax conversion
export const emailToFaxQueue = new Queue<EmailToFaxJobData>(
  'email-to-fax',
  queueOptions
);

// Helper function to enqueue fax processing job
export async function enqueueFaxProcessing(data: FaxJobData): Promise<string> {
  const job = await faxProcessingQueue.add('process-fax', data, {
    jobId: data.faxId, // Use faxId as jobId for idempotency
  });
  return job.id!;
}

// Helper function to enqueue email-to-fax job
export async function enqueueEmailToFax(
  data: EmailToFaxJobData
): Promise<string> {
  const job = await emailToFaxQueue.add('email-to-fax', data);
  return job.id!;
}

// Health check for queues
export async function checkQueueHealth(): Promise<{
  faxProcessing: boolean;
  emailToFax: boolean;
}> {
  try {
    const faxClient = await faxProcessingQueue.client;
    const emailClient = await emailToFaxQueue.client;
    await faxClient.ping();
    await emailClient.ping();
    return {
      faxProcessing: true,
      emailToFax: true,
    };
  } catch (error) {
    console.error('Queue health check failed:', error);
    return {
      faxProcessing: false,
      emailToFax: false,
    };
  }
}
