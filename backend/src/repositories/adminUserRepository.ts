import { db } from '../database/connection';
import { AdminUser, AdminRefreshToken } from '../services/adminAuthService';

export interface CreateAdminUserData {
  email: string;
  passwordHash: string;
  name: string;
  role: 'super_admin' | 'admin' | 'support' | 'analyst';
  isActive?: boolean;
}

export interface UpdateAdminUserData {
  email?: string;
  passwordHash?: string;
  name?: string;
  role?: 'super_admin' | 'admin' | 'support' | 'analyst';
  isActive?: boolean;
  lastLoginAt?: Date;
}

export interface AdminPreferences {
  id: string;
  adminUserId: string;
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Admin User Repository
 * Handles database operations for admin users, tokens, and preferences
 */
export class AdminUserRepository {
  /**
   * Create a new admin user
   */
  async create(data: CreateAdminUserData): Promise<AdminUser> {
    const result = await db.query<AdminUser>(
      `INSERT INTO admin_users (email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, is_active as "isActive", 
                 last_login_at as "lastLoginAt", created_at as "createdAt", 
                 updated_at as "updatedAt"`,
      [data.email, data.passwordHash, data.name, data.role, data.isActive ?? true]
    );

    return result.rows[0];
  }

  /**
   * Find admin user by ID
   */
  async findById(id: string): Promise<AdminUser | null> {
    const result = await db.query<AdminUser>(
      `SELECT id, email, name, role, is_active as "isActive", 
              last_login_at as "lastLoginAt", created_at as "createdAt", 
              updated_at as "updatedAt"
       FROM admin_users 
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find admin user by email
   */
  async findByEmail(email: string): Promise<AdminUser | null> {
    const result = await db.query<AdminUser>(
      `SELECT id, email, name, role, is_active as "isActive", 
              last_login_at as "lastLoginAt", created_at as "createdAt", 
              updated_at as "updatedAt"
       FROM admin_users 
       WHERE email = $1`,
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Find admin user by email with password hash (for authentication)
   */
  async findByEmailWithPassword(email: string): Promise<(AdminUser & { passwordHash: string }) | null> {
    const result = await db.query<AdminUser & { passwordHash: string }>(
      `SELECT id, email, password_hash as "passwordHash", name, role, 
              is_active as "isActive", last_login_at as "lastLoginAt", 
              created_at as "createdAt", updated_at as "updatedAt"
       FROM admin_users 
       WHERE email = $1`,
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Update admin user
   */
  async update(id: string, data: UpdateAdminUserData): Promise<AdminUser | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.email !== undefined) {
      fields.push(`email = $${paramCount++}`);
      values.push(data.email);
    }
    if (data.passwordHash !== undefined) {
      fields.push(`password_hash = $${paramCount++}`);
      values.push(data.passwordHash);
    }
    if (data.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.role !== undefined) {
      fields.push(`role = $${paramCount++}`);
      values.push(data.role);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(data.isActive);
    }
    if (data.lastLoginAt !== undefined) {
      fields.push(`last_login_at = $${paramCount++}`);
      values.push(data.lastLoginAt);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await db.query<AdminUser>(
      `UPDATE admin_users 
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, name, role, is_active as "isActive", 
                 last_login_at as "lastLoginAt", created_at as "createdAt", 
                 updated_at as "updatedAt"`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete admin user
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM admin_users WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * List all admin users with pagination
   */
  async list(limit: number = 50, offset: number = 0): Promise<AdminUser[]> {
    const result = await db.query<AdminUser>(
      `SELECT id, email, name, role, is_active as "isActive", 
              last_login_at as "lastLoginAt", created_at as "createdAt", 
              updated_at as "updatedAt"
       FROM admin_users 
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows;
  }

  /**
   * Count total admin users
   */
  async count(): Promise<number> {
    const result = await db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM admin_users'
    );

    return parseInt(result.rows[0].count, 10);
  }

  // ==================== Refresh Token Management ====================

  /**
   * Create a refresh token
   */
  async createRefreshToken(adminUserId: string, tokenId: string, expiresAt: Date): Promise<AdminRefreshToken> {
    const result = await db.query<AdminRefreshToken>(
      `INSERT INTO admin_refresh_tokens (admin_user_id, token_id, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, admin_user_id as "adminUserId", token_id as "tokenId", 
                 expires_at as "expiresAt", created_at as "createdAt", 
                 revoked_at as "revokedAt"`,
      [adminUserId, tokenId, expiresAt]
    );

    return result.rows[0];
  }

  /**
   * Find refresh token by token ID
   */
  async findRefreshToken(tokenId: string): Promise<AdminRefreshToken | null> {
    const result = await db.query<AdminRefreshToken>(
      `SELECT id, admin_user_id as "adminUserId", token_id as "tokenId", 
              expires_at as "expiresAt", created_at as "createdAt", 
              revoked_at as "revokedAt"
       FROM admin_refresh_tokens 
       WHERE token_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [tokenId]
    );

    return result.rows[0] || null;
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(tokenId: string): Promise<boolean> {
    const result = await db.query(
      `UPDATE admin_refresh_tokens 
       SET revoked_at = NOW() 
       WHERE token_id = $1`,
      [tokenId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(adminUserId: string): Promise<number> {
    const result = await db.query(
      `UPDATE admin_refresh_tokens 
       SET revoked_at = NOW() 
       WHERE admin_user_id = $1 AND revoked_at IS NULL`,
      [adminUserId]
    );

    return result.rowCount ?? 0;
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await db.query(
      'DELETE FROM admin_refresh_tokens WHERE expires_at < NOW()'
    );

    return result.rowCount ?? 0;
  }

  // ==================== Preferences Management ====================

  /**
   * Get admin user preferences
   */
  async getPreferences(adminUserId: string): Promise<AdminPreferences | null> {
    const result = await db.query<AdminPreferences>(
      `SELECT id, admin_user_id as "adminUserId", preferences, 
              created_at as "createdAt", updated_at as "updatedAt"
       FROM admin_preferences 
       WHERE admin_user_id = $1`,
      [adminUserId]
    );

    return result.rows[0] || null;
  }

  /**
   * Set admin user preferences
   */
  async setPreferences(adminUserId: string, preferences: Record<string, any>): Promise<AdminPreferences> {
    const result = await db.query<AdminPreferences>(
      `INSERT INTO admin_preferences (admin_user_id, preferences)
       VALUES ($1, $2)
       ON CONFLICT (admin_user_id) 
       DO UPDATE SET preferences = $2, updated_at = NOW()
       RETURNING id, admin_user_id as "adminUserId", preferences, 
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [adminUserId, JSON.stringify(preferences)]
    );

    return result.rows[0];
  }

  /**
   * Update specific preference keys
   */
  async updatePreferences(adminUserId: string, updates: Record<string, any>): Promise<AdminPreferences | null> {
    const current = await this.getPreferences(adminUserId);
    
    if (!current) {
      return this.setPreferences(adminUserId, updates);
    }

    const merged = { ...current.preferences, ...updates };
    return this.setPreferences(adminUserId, merged);
  }
}

export const adminUserRepository = new AdminUserRepository();
