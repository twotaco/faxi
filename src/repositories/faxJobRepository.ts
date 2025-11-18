import { db } from '../database/connection';

export interface FaxJob {
  id: string;
  faxId: string;
  referenceId: string | null;
  userId: string | null;
  direction: 'inbound' | 'outbound';
  fromNumber: string;
  toNumber: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  pageCount: number | null;
  mediaUrl: string | null;
  storageKey: string | null;
  webhookPayload: any;
  interpretationResult: any;
  actionResults: any;
  errorMessage: string | null;
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
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  pageCount?: number;
  mediaUrl?: string;
  storageKey?: string;
  webhookPayload?: any;
}

export interface UpdateFaxJobData {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  storageKey?: string;
  interpretationResult?: any;
  actionResults?: any;
  errorMessage?: string;
  completedAt?: Date;
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
        page_count, media_url, storage_key, webhook_payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, fax_id as "faxId", reference_id as "referenceId", user_id as "userId",
                 direction, from_number as "fromNumber", to_number as "toNumber", status,
                 page_count as "pageCount", media_url as "mediaUrl", storage_key as "storageKey",
                 webhook_payload as "webhookPayload", interpretation_result as "interpretationResult",
                 action_results as "actionResults", error_message as "errorMessage",
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
                 created_at as "createdAt", updated_at as "updatedAt", completed_at as "completedAt"`,
      values
    );

    return result.rows[0];
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
