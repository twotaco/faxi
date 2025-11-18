import { db } from '../database/connection';

export interface FaxJob {
  id: string;
  faxId: string;
  referenceId: string | null;
  userId: string | null;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'sending' | 'delivered';
  pageCount: number | null;
  mediaUrl: string | null;
  storageKey: string | null;
  webhookPayload: any;
  interpretationResult: any;
  actionResults: any;
  errorMessage: string | null;
  deliveredAt: Date | null;
  telnyxFaxId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface CreateFaxJobData {
  faxId: string;
  userId?: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'sending' | 'delivered';
  pageCount?: number;
  mediaUrl?: string;
  storageKey?: string;
  webhookPayload?: any;
  telnyxFaxId?: string;
}

export interface UpdateFaxJobData {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'sending' | 'delivered';
  storageKey?: string;
  interpretationResult?: any;
  actionResults?: any;
  errorMessage?: string;
  completedAt?: Date;
  deliveredAt?: Date;
  telnyxFaxId?: string;
  errorType?: string;
  stage?: string;
  retryCount?: number;
  responseReferenceId?: string;
  responseFaxId?: string;
}

export class FaxJobRepository {
  /**
   * Find fax job by ID
   */
  async findById(id: string): Promise<FaxJob | null> {
    const result = await db.query<FaxJob>(
      `SELECT id, fax_id as "faxId", reference_id as "referenceId", user_id as "userId",
              direction, from_number as "fromNumber", to_number as "toNumber", status,
              page_count as "pageCount", media_url as "mediaUrl", storage_key as "storageKey",
              webhook_payload as "webhookPayload", interpretation_result as "interpretationResult",
              action_results as "actionResults", error_message as "errorMessage",
              delivered_at as "deliveredAt", telnyx_fax_id as "telnyxFaxId",
              created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"
       FROM fax_jobs 
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find fax job by Telnyx fax ID (for idempotency)
   */
  async findByFaxId(faxId: string): Promise<FaxJob | null> {
    const result = await db.query<FaxJob>(
      `SELECT id, fax_id as "faxId", reference_id as "referenceId", user_id as "userId",
              direction, from_number as "fromNumber", to_number as "toNumber", status,
              page_count as "pageCount", media_url as "mediaUrl", storage_key as "storageKey",
              webhook_payload as "webhookPayload", interpretation_result as "interpretationResult",
              action_results as "actionResults", error_message as "errorMessage",
              delivered_at as "deliveredAt", telnyx_fax_id as "telnyxFaxId",
              created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"
       FROM fax_jobs 
       WHERE fax_id = $1`,
      [faxId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find fax job by reference ID
   */
  async findByReferenceId(referenceId: string): Promise<FaxJob | null> {
    const result = await db.query<FaxJob>(
      `SELECT id, fax_id as "faxId", reference_id as "referenceId", user_id as "userId",
              direction, from_number as "fromNumber", to_number as "toNumber", status,
              page_count as "pageCount", media_url as "mediaUrl", storage_key as "storageKey",
              webhook_payload as "webhookPayload", interpretation_result as "interpretationResult",
              action_results as "actionResults", error_message as "errorMessage",
              delivered_at as "deliveredAt", telnyx_fax_id as "telnyxFaxId",
              created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"
       FROM fax_jobs 
       WHERE reference_id = $1`,
      [referenceId]
    );

    return result.rows[0] || null;
  }

  /**
   * Create a new fax job
   */
  async create(data: CreateFaxJobData): Promise<FaxJob> {
    const result = await db.query<FaxJob>(
      `INSERT INTO fax_jobs (
        fax_id, user_id, direction, from_number, to_number, status,
        page_count, media_url, storage_key, webhook_payload, telnyx_fax_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, fax_id as "faxId", reference_id as "referenceId", user_id as "userId",
                 direction, from_number as "fromNumber", to_number as "toNumber", status,
                 page_count as "pageCount", media_url as "mediaUrl", storage_key as "storageKey",
                 webhook_payload as "webhookPayload", interpretation_result as "interpretationResult",
                 action_results as "actionResults", error_message as "errorMessage",
                 delivered_at as "deliveredAt", telnyx_fax_id as "telnyxFaxId",
                 created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"`,
      [
        data.faxId,
        data.userId || null,
        data.direction,
        data.fromNumber,
        data.toNumber,
        data.status || 'pending',
        data.pageCount || null,
        data.mediaUrl || null,
        data.storageKey || null,
        data.webhookPayload ? JSON.stringify(data.webhookPayload) : null,
        data.telnyxFaxId || null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update fax job
   */
  async update(id: string, data: UpdateFaxJobData): Promise<FaxJob> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.storageKey !== undefined) {
      updates.push(`storage_key = $${paramIndex++}`);
      values.push(data.storageKey);
    }

    if (data.interpretationResult !== undefined) {
      updates.push(`interpretation_result = $${paramIndex++}`);
      values.push(JSON.stringify(data.interpretationResult));
    }

    if (data.actionResults !== undefined) {
      updates.push(`action_results = $${paramIndex++}`);
      values.push(JSON.stringify(data.actionResults));
    }

    if (data.errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(data.errorMessage);
    }

    if (data.completedAt !== undefined) {
      updates.push(`completed_at = $${paramIndex++}`);
      values.push(data.completedAt);
    }

    if (data.deliveredAt !== undefined) {
      updates.push(`delivered_at = $${paramIndex++}`);
      values.push(data.deliveredAt);
    }

    if (data.telnyxFaxId !== undefined) {
      updates.push(`telnyx_fax_id = $${paramIndex++}`);
      values.push(data.telnyxFaxId);
    }

    if (data.errorType !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(`${data.errorMessage || ''} (Type: ${data.errorType})`);
    }

    if (data.responseReferenceId !== undefined) {
      // Store in action_results for now
      const existingResults = data.actionResults || {};
      updates.push(`action_results = $${paramIndex++}`);
      values.push(JSON.stringify({
        ...existingResults,
        responseReferenceId: data.responseReferenceId,
        responseFaxId: data.responseFaxId
      }));
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const result = await db.query<FaxJob>(
      `UPDATE fax_jobs 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, fax_id as "faxId", reference_id as "referenceId", user_id as "userId",
                 direction, from_number as "fromNumber", to_number as "toNumber", status,
                 page_count as "pageCount", media_url as "mediaUrl", storage_key as "storageKey",
                 webhook_payload as "webhookPayload", interpretation_result as "interpretationResult",
                 action_results as "actionResults", error_message as "errorMessage",
                 delivered_at as "deliveredAt", telnyx_fax_id as "telnyxFaxId",
                 created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"`,
      values
    );

    return result.rows[0];
  }

  /**
   * Update fax job status by fax ID
   */
  async updateStatus(
    faxId: string, 
    status: FaxJob['status'], 
    additionalData?: Partial<UpdateFaxJobData>
  ): Promise<FaxJob> {
    const updateData: UpdateFaxJobData = {
      status,
      ...additionalData,
    };

    // Set completion time for completed/failed status
    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    // Set delivery time for delivered status
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    }

    const job = await this.findByFaxId(faxId);
    if (!job) {
      throw new Error(`Fax job not found: ${faxId}`);
    }

    return await this.update(job.id, updateData);
  }

  /**
   * Find recent fax jobs for a user
   */
  async findRecentByUser(
    userId: string,
    limit: number = 10
  ): Promise<FaxJob[]> {
    const result = await db.query<FaxJob>(
      `SELECT id, fax_id as "faxId", reference_id as "referenceId", user_id as "userId",
              direction, from_number as "fromNumber", to_number as "toNumber", status,
              page_count as "pageCount", media_url as "mediaUrl", storage_key as "storageKey",
              webhook_payload as "webhookPayload", interpretation_result as "interpretationResult",
              action_results as "actionResults", error_message as "errorMessage",
              delivered_at as "deliveredAt", telnyx_fax_id as "telnyxFaxId",
              created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"
       FROM fax_jobs 
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }
}

export const faxJobRepository = new FaxJobRepository();