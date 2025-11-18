import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 days

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'support' | 'analyst';
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminTokenPayload {
  userId: string;
  email: string;
  role: 'super_admin' | 'admin' | 'support' | 'analyst';
  iat: number;
  exp: number;
}

export interface AdminRefreshToken {
  id: string;
  adminUserId: string;
  tokenId: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Admin Authentication Service
 * Handles password hashing, JWT token generation, and session management
 */
export class AdminAuthService {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = config.jwt?.secret || process.env.JWT_SECRET || 'faxi-admin-secret-change-in-production';
    
    if (this.jwtSecret === 'faxi-admin-secret-change-in-production' && config.app.env === 'production') {
      console.warn('WARNING: Using default JWT secret in production! Set JWT_SECRET environment variable.');
    }
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate access token (JWT) - expires in 15 minutes
   */
  generateAccessToken(user: AdminUser): string {
    const payload: Omit<AdminTokenPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: 'faxi-admin',
      audience: 'faxi-admin-dashboard',
    });
  }

  /**
   * Generate refresh token ID - stored in database
   */
  generateRefreshTokenId(): string {
    return uuidv4();
  }

  /**
   * Calculate refresh token expiry date
   */
  getRefreshTokenExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    return expiry;
  }

  /**
   * Generate both access and refresh tokens
   */
  async generateTokens(user: AdminUser): Promise<{ accessToken: string; refreshTokenId: string; expiresAt: Date }> {
    const accessToken = this.generateAccessToken(user);
    const refreshTokenId = this.generateRefreshTokenId();
    const expiresAt = this.getRefreshTokenExpiry();

    return {
      accessToken,
      refreshTokenId,
      expiresAt,
    };
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): AdminTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'faxi-admin',
        audience: 'faxi-admin-dashboard',
      }) as AdminTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.log('Invalid access token');
      }
      return null;
    }
  }

  /**
   * Decode token without verification (for expired tokens)
   */
  decodeToken(token: string): AdminTokenPayload | null {
    try {
      return jwt.decode(token) as AdminTokenPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 12) {
      errors.push('Password must be at least 12 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = uppercase + lowercase + numbers + special;

    let password = '';
    
    // Ensure at least one of each required character type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

export const adminAuthService = new AdminAuthService();
