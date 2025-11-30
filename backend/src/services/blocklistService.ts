import { db } from '../database/connection';
import { auditLogService } from './auditLogService';

/**
 * BlocklistService
 * 
 * Manages per-user email blocklists for spam prevention.
 * Allows users to block/unblock email senders via fax commands.
 * 
 * Requirements: 15.1, 15.4, 15.6, 15.7
 */
export class BlocklistService {
  /**
   * Add an email address to user's blocklist
   * 
   * @param userId - User ID
   * @param emailAddress - Email address to block (will be normalized to lowercase)
   * @returns Promise<void>
   * 
   * Requirements: 15.1, 15.6
   */
  async blockSender(userId: string, emailAddress: string): Promise<void> {
    const normalizedEmail = emailAddress.toLowerCase().trim();
    
    try {
      await db.query(
        `INSERT INTO email_blocklist (user_id, blocked_email)
         VALUES ($1, $2)
         ON CONFLICT (user_id, blocked_email) DO NOTHING`,
        [userId, normalizedEmail]
      );
      
      await auditLogService.log({
        userId,
        eventType: 'email.sender_blocked',
        eventData: {
          blockedEmail: normalizedEmail
        }
      });
    } catch (error) {
      await auditLogService.log({
        userId,
        eventType: 'email.sender_block_failed',
        eventData: {
          blockedEmail: normalizedEmail,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Remove an email address from user's blocklist
   * 
   * @param userId - User ID
   * @param emailAddress - Email address to unblock (will be normalized to lowercase)
   * @returns Promise<void>
   * 
   * Requirements: 15.4, 15.6
   */
  async unblockSender(userId: string, emailAddress: string): Promise<void> {
    const normalizedEmail = emailAddress.toLowerCase().trim();
    
    try {
      const result = await db.query(
        `DELETE FROM email_blocklist
         WHERE user_id = $1 AND LOWER(blocked_email) = $2`,
        [userId, normalizedEmail]
      );
      
      await auditLogService.log({
        userId,
        eventType: 'email.sender_unblocked',
        eventData: {
          unblockedEmail: normalizedEmail,
          wasBlocked: result.rowCount > 0
        }
      });
    } catch (error) {
      await auditLogService.log({
        userId,
        eventType: 'email.sender_unblock_failed',
        eventData: {
          unblockedEmail: normalizedEmail,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Check if a sender email is blocked for a user
   * Performs case-insensitive matching
   * 
   * @param userId - User ID
   * @param senderEmail - Email address to check (case-insensitive)
   * @returns Promise<boolean> - true if blocked, false otherwise
   * 
   * Requirements: 15.2, 15.3, 15.6, 15.7
   */
  async isBlocked(userId: string, senderEmail: string): Promise<boolean> {
    const normalizedEmail = senderEmail.toLowerCase().trim();
    
    const result = await db.query(
      `SELECT 1 FROM email_blocklist
       WHERE user_id = $1 AND LOWER(blocked_email) = $2
       LIMIT 1`,
      [userId, normalizedEmail]
    );
    
    return result.rowCount > 0;
  }

  /**
   * Get user's complete blocklist
   * 
   * @param userId - User ID
   * @returns Promise<string[]> - Array of blocked email addresses
   * 
   * Requirements: 15.7
   */
  async getBlocklist(userId: string): Promise<string[]> {
    const result = await db.query(
      `SELECT blocked_email
       FROM email_blocklist
       WHERE user_id = $1
       ORDER BY blocked_at DESC`,
      [userId]
    );
    
    return result.rows.map(row => row.blocked_email);
  }
}

// Export singleton instance
export const blocklistService = new BlocklistService();
