import { Request, Response, NextFunction } from 'express';
import { adminAuthService, AdminTokenPayload } from '../services/adminAuthService';
import { adminUserRepository } from '../repositories/adminUserRepository';

// Extend Express Request to include admin user
declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        id: string;
        email: string;
        role: 'super_admin' | 'admin' | 'support' | 'analyst';
      };
    }
  }
}

/**
 * Permission definitions for each role
 */
const PERMISSIONS = {
  super_admin: ['*'], // All permissions
  admin: [
    'dashboard:view',
    'jobs:view',
    'jobs:retry',
    'jobs:cancel',
    'users:view',
    'users:edit',
    'users:feature-flags',
    'mcp:view',
    'mcp:control',
    'ai:view',
    'ai:feedback',
    'financial:view',
    'alerts:view',
    'alerts:manage',
    'config:view',
    'config:edit',
    'analytics:view',
    'audit:view',
  ],
  support: [
    'dashboard:view',
    'jobs:view',
    'jobs:retry',
    'users:view',
    'mcp:view',
    'ai:view',
    'financial:view',
    'alerts:view',
    'analytics:view',
    'audit:view',
  ],
  analyst: [
    'dashboard:view',
    'jobs:view',
    'users:view',
    'mcp:view',
    'ai:view',
    'financial:view',
    'analytics:view',
    'audit:view',
  ],
};

/**
 * Middleware to verify admin authentication
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = adminAuthService.verifyAccessToken(token);

    if (!payload) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    // Attach user info to request
    req.adminUser = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication',
    });
  }
}

/**
 * Middleware to check if admin user has specific permission
 */
export function requirePermission(...permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Check if user is active
      const user = await adminUserRepository.findById(req.adminUser.id);

      if (!user || !user.isActive) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Your account has been deactivated',
        });
      }

      // Super admin has all permissions
      if (req.adminUser.role === 'super_admin') {
        return next();
      }

      // Get role permissions
      const rolePermissions = PERMISSIONS[req.adminUser.role] || [];

      // Check if user has required permissions
      const hasPermission = permissions.every(permission => 
        rolePermissions.includes(permission) || rolePermissions.includes('*')
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to perform this action',
          required: permissions,
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        error: 'Authorization error',
        message: 'An error occurred during authorization',
      });
    }
  };
}

/**
 * Helper function to check if a role has a specific permission
 */
export function hasPermission(role: string, permission: string): boolean {
  const rolePermissions = PERMISSIONS[role as keyof typeof PERMISSIONS] || [];
  return rolePermissions.includes('*') || rolePermissions.includes(permission);
}

/**
 * Middleware to check if admin user has specific role
 */
export function requireRole(...roles: Array<'super_admin' | 'admin' | 'support' | 'analyst'>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.adminUser) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Check if user is active
      const user = await adminUserRepository.findById(req.adminUser.id);

      if (!user || !user.isActive) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Your account has been deactivated',
        });
      }

      // Check if user has required role
      if (!roles.includes(req.adminUser.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have the required role to perform this action',
          required: roles,
          current: req.adminUser.role,
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({
        error: 'Authorization error',
        message: 'An error occurred during authorization',
      });
    }
  };
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: string): string[] {
  return PERMISSIONS[role as keyof typeof PERMISSIONS] || [];
}
