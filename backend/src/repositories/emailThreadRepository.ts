import { db } from '../database/connection';

export interface EmailThread {
  id: string;
  userId: string;
  threadId: string;
  subject: string;
  participants: string[];
  lastMessageAt: Date;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailMessage {
  id: string;
  threadId: string | null;
  messageId: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  direction: 'inbound' | 'outbound';
  rejectionReason?: string | null;
  sentAt: Date;
  createdAt: Date;
}

export interface CreateEmailThreadData {
  userId: string;
  threadId: string;
  subject: string;
  participants: string[];
  lastMessageAt: Date;
}

export interface CreateEmailMessageData {
  threadId: string;
  messageId: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  direction: 'inbound' | 'outbound';
  sentAt: Date;
  rejectionReason?: string;
}

export interface CreateOrphanEmailMessageData {
  messageId: string;
  fromAddress: string;
  toAddresses: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  direction: 'inbound' | 'outbound';
  sentAt: Date;
  rejectionReason: string;
}

export class EmailThreadRepository {
  /**
   * Find email thread by thread ID
   */
  async findByThreadId(threadId: string): Promise<EmailThread | null> {
    const result = await db.query<EmailThread>(
      `SELECT id, user_id as "userId", thread_id as "threadId", subject,
              participants, last_message_at as "lastMessageAt", message_count as "messageCount",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM email_threads 
       WHERE thread_id = $1`,
      [threadId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find email threads for a user
   */
  async findByUserId(userId: string, limit: number = 50): Promise<EmailThread[]> {
    const result = await db.query<EmailThread>(
      `SELECT id, user_id as "userId", thread_id as "threadId", subject,
              participants, last_message_at as "lastMessageAt", message_count as "messageCount",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM email_threads 
       WHERE user_id = $1
       ORDER BY last_message_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Search email threads by subject or participants
   */
  async searchThreads(userId: string, query: string, limit: number = 10): Promise<EmailThread[]> {
    const result = await db.query<EmailThread>(
      `SELECT id, user_id as "userId", thread_id as "threadId", subject,
              participants, last_message_at as "lastMessageAt", message_count as "messageCount",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM email_threads 
       WHERE user_id = $1 
         AND (subject ILIKE $2 OR participants::text ILIKE $2)
       ORDER BY last_message_at DESC
       LIMIT $3`,
      [userId, `%${query}%`, limit]
    );

    return result.rows;
  }

  /**
   * Create email thread
   */
  async create(data: CreateEmailThreadData): Promise<EmailThread> {
    const result = await db.query<EmailThread>(
      `INSERT INTO email_threads (user_id, thread_id, subject, participants, last_message_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id as "userId", thread_id as "threadId", subject,
                 participants, last_message_at as "lastMessageAt", message_count as "messageCount",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.userId,
        data.threadId,
        data.subject,
        JSON.stringify(data.participants),
        data.lastMessageAt,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update thread with new message
   */
  async updateWithNewMessage(threadId: string, lastMessageAt: Date): Promise<void> {
    await db.query(
      `UPDATE email_threads 
       SET last_message_at = $2, message_count = message_count + 1
       WHERE thread_id = $1`,
      [threadId, lastMessageAt]
    );
  }

  /**
   * Find or create email thread
   */
  async findOrCreate(data: CreateEmailThreadData): Promise<EmailThread> {
    const existing = await this.findByThreadId(data.threadId);
    if (existing) {
      return existing;
    }
    
    return await this.create(data);
  }
}

export class EmailMessageRepository {
  /**
   * Find messages in a thread
   */
  async findByThreadId(threadId: string, limit: number = 50): Promise<EmailMessage[]> {
    // First get the thread UUID from thread_id
    const threadResult = await db.query(
      'SELECT id FROM email_threads WHERE thread_id = $1',
      [threadId]
    );

    if (threadResult.rows.length === 0) {
      return [];
    }

    const threadUuid = threadResult.rows[0].id;

    const result = await db.query<EmailMessage>(
      `SELECT id, thread_id as "threadId", message_id as "messageId",
              from_address as "fromAddress", to_addresses as "toAddresses",
              cc_addresses as "ccAddresses", subject, body, html_body as "htmlBody",
              direction, sent_at as "sentAt", created_at as "createdAt"
       FROM email_messages 
       WHERE thread_id = $1
       ORDER BY sent_at ASC
       LIMIT $2`,
      [threadUuid, limit]
    );

    return result.rows;
  }

  /**
   * Find message by message ID
   */
  async findByMessageId(messageId: string): Promise<EmailMessage | null> {
    const result = await db.query<EmailMessage>(
      `SELECT id, thread_id as "threadId", message_id as "messageId",
              from_address as "fromAddress", to_addresses as "toAddresses",
              cc_addresses as "ccAddresses", subject, body, html_body as "htmlBody",
              direction, sent_at as "sentAt", created_at as "createdAt"
       FROM email_messages 
       WHERE message_id = $1`,
      [messageId]
    );

    return result.rows[0] || null;
  }

  /**
   * Create email message
   */
  async create(data: CreateEmailMessageData): Promise<EmailMessage> {
    // First get the thread UUID from thread_id
    const threadResult = await db.query(
      'SELECT id FROM email_threads WHERE thread_id = $1',
      [data.threadId]
    );

    if (threadResult.rows.length === 0) {
      throw new Error(`Thread not found: ${data.threadId}`);
    }

    const threadUuid = threadResult.rows[0].id;

    const result = await db.query<EmailMessage>(
      `INSERT INTO email_messages (thread_id, message_id, from_address, to_addresses,
                                   cc_addresses, subject, body, html_body, direction, sent_at, rejection_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, thread_id as "threadId", message_id as "messageId",
                 from_address as "fromAddress", to_addresses as "toAddresses",
                 cc_addresses as "ccAddresses", subject, body, html_body as "htmlBody",
                 direction, rejection_reason as "rejectionReason", sent_at as "sentAt", created_at as "createdAt"`,
      [
        threadUuid,
        data.messageId,
        data.fromAddress,
        JSON.stringify(data.toAddresses),
        data.ccAddresses ? JSON.stringify(data.ccAddresses) : null,
        data.subject,
        data.body,
        data.htmlBody || null,
        data.direction,
        data.sentAt,
        data.rejectionReason || null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Create orphan email message (no thread - for rejected emails to unregistered recipients)
   */
  async createOrphan(data: CreateOrphanEmailMessageData): Promise<EmailMessage> {
    const result = await db.query<EmailMessage>(
      `INSERT INTO email_messages (thread_id, message_id, from_address, to_addresses,
                                   subject, body, html_body, direction, sent_at, rejection_reason)
       VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, thread_id as "threadId", message_id as "messageId",
                 from_address as "fromAddress", to_addresses as "toAddresses",
                 subject, body, html_body as "htmlBody",
                 direction, rejection_reason as "rejectionReason", sent_at as "sentAt", created_at as "createdAt"`,
      [
        data.messageId,
        data.fromAddress,
        JSON.stringify(data.toAddresses),
        data.subject,
        data.body,
        data.htmlBody || null,
        data.direction,
        data.sentAt,
        data.rejectionReason,
      ]
    );

    return result.rows[0];
  }

  /**
   * Search messages by content
   */
  async searchMessages(userId: string, query: string, limit: number = 10): Promise<EmailMessage[]> {
    const result = await db.query<EmailMessage>(
      `SELECT em.id, em.thread_id as "threadId", em.message_id as "messageId",
              em.from_address as "fromAddress", em.to_addresses as "toAddresses",
              em.cc_addresses as "ccAddresses", em.subject, em.body, em.html_body as "htmlBody",
              em.direction, em.sent_at as "sentAt", em.created_at as "createdAt"
       FROM email_messages em
       JOIN email_threads et ON em.thread_id = et.id
       WHERE et.user_id = $1 
         AND (em.subject ILIKE $2 OR em.body ILIKE $2 OR em.from_address ILIKE $2)
       ORDER BY em.sent_at DESC
       LIMIT $3`,
      [userId, `%${query}%`, limit]
    );

    return result.rows;
  }
}

export const emailThreadRepository = new EmailThreadRepository();
export const emailMessageRepository = new EmailMessageRepository();