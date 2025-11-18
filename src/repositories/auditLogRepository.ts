import { db } from '../database/connection';

export interface AuditLog {
  id: string;
  userId: string | null;
  faxJobId: string | null;
  eventType: string;
  eventData: any;
  createdAt: Date;
}

export interface CreateAuditLogData {
  userId?: string;
  faxJobId?: string;
  eventType: string;
  eventData: any;
}

export class AuditLogRepository {
  /**
   * Create an audit log entry
   */
  async create(data: CreateAuditLogData): Promise<AuditLog> {
    const result = await db.query<AuditLog>(
      `INSERT INTO audit_logs (user_id, fax_job_id, event_type, event_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id as "userId", fax_job_id as "faxJobId", 
                 event_type as "eventType", event_data as "eventData", 
                 created_at as "createdAt"`,
      [
        data.userId || null,
        data.faxJobId || null,
        data.eventType,
        JSON.stringify(data.eventData),
      ]
    );

    return result.rows[0];
  }

  /**
   * Find audit logs by fax job ID
   */
  async findByFaxJobId(faxJobId: string, limit: number = 100): Promise<AuditLog[]> {
    const result = await db.query<AuditLog>(
      `SELECT id, user_id as "userId", fax_job_id as "faxJobId", 
              event_type as "eventType", event_data as "eventData", 
              created_at as "createdAt"
       FROM audit_logs 
       WHERE fax_job_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [faxJobId, limit]
    );

    return result.rows;
  }

  /**
   * Find audit logs by user ID
   */
  async findByUserId(userId: string, limit: number = 100): Promise<AuditLog[]> {
    const result = await db.query<AuditLog>(
      `SELECT id, user_id as "userId", fax_job_id as "faxJobId", 
              event_type as "eventType", event_data as "eventData", 
              created_at as "createdAt"
       FROM audit_logs 
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Find audit logs by event type
   */
  async findByEventType(eventType: string, limit: number = 100): Promise<AuditLog[]> {
    const result = await db.query<AuditLog>(
      `SELECT id, user_id as "userId", fax_job_id as "faxJobId", 
              event_type as "eventType", event_data as "eventData", 
              created_at as "createdAt"
       FROM audit_logs 
       WHERE event_type = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [eventType, limit]
    );

    return result.rows;
  }
}

export const auditLogRepository = new AuditLogRepository();
