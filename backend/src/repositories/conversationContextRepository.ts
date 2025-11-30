import { db } from '../database/connection';

export interface ConversationContext {
  id: string;
  userId: string;
  referenceId: string;
  contextType: string;
  contextData: any;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationContextData {
  userId: string;
  referenceId: string;
  contextType: string;
  contextData: any;
  expiresAt: Date;
  createdAt?: Date;
}

export interface UpdateConversationContextData {
  contextData?: any;
  expiresAt?: Date;
}

export class ConversationContextRepository {
  /**
   * Find conversation context by ID
   */
  async findById(id: string): Promise<ConversationContext | null> {
    const result = await db.query<ConversationContext>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              context_type as "contextType", context_data as "contextData",
              expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"
       FROM conversation_contexts 
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find conversation context by reference ID
   */
  async findByReferenceId(referenceId: string): Promise<ConversationContext | null> {
    const result = await db.query<ConversationContext>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              context_type as "contextType", context_data as "contextData",
              expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"
       FROM conversation_contexts 
       WHERE reference_id = $1`,
      [referenceId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find active conversation contexts for a user
   * Active means not expired
   */
  async findActiveByUser(userId: string): Promise<ConversationContext[]> {
    const result = await db.query<ConversationContext>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              context_type as "contextType", context_data as "contextData",
              expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"
       FROM conversation_contexts 
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Find recent conversation contexts for a user within a time window
   * Useful for context recovery
   */
  async findRecentByUser(
    userId: string,
    daysBack: number = 7
  ): Promise<ConversationContext[]> {
    const result = await db.query<ConversationContext>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              context_type as "contextType", context_data as "contextData",
              expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"
       FROM conversation_contexts 
       WHERE user_id = $1 
         AND created_at > NOW() - INTERVAL '${daysBack} days'
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Create a new conversation context
   */
  async create(data: CreateConversationContextData): Promise<ConversationContext> {
    const result = await db.query<ConversationContext>(
      `INSERT INTO conversation_contexts (
        user_id, reference_id, context_type, context_data, expires_at
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id as "userId", reference_id as "referenceId",
                 context_type as "contextType", context_data as "contextData",
                 expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.userId,
        data.referenceId,
        data.contextType,
        JSON.stringify(data.contextData),
        data.expiresAt,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update conversation context
   */
  async update(id: string, data: UpdateConversationContextData): Promise<ConversationContext> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.contextData !== undefined) {
      updates.push(`context_data = $${paramIndex++}`);
      values.push(JSON.stringify(data.contextData));
    }

    if (data.expiresAt !== undefined) {
      updates.push(`expires_at = $${paramIndex++}`);
      values.push(data.expiresAt);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const result = await db.query<ConversationContext>(
      `UPDATE conversation_contexts 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, user_id as "userId", reference_id as "referenceId",
                 context_type as "contextType", context_data as "contextData",
                 expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete expired conversation contexts
   * Should be run periodically as a cleanup job
   */
  async deleteExpired(): Promise<number> {
    const result = await db.query(
      `DELETE FROM conversation_contexts 
       WHERE expires_at < NOW()`,
      []
    );

    return result.rowCount || 0;
  }

  /**
   * Expire a specific conversation context immediately
   */
  async expire(id: string): Promise<void> {
    await db.query(
      `UPDATE conversation_contexts
       SET expires_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Delete a specific conversation context by ID
   */
  async delete(id: string): Promise<void> {
    await db.query(
      `DELETE FROM conversation_contexts WHERE id = $1`,
      [id]
    );
  }
}

export const conversationContextRepository = new ConversationContextRepository();
