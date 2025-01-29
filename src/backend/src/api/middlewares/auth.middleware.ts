import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { AuthError } from '../../core/errors/AuthError';
import { verifyToken } from '../../core/utils/token.util';
import { IAuthUser, UserRole } from '../../core/interfaces/auth.interface';

// Constants for authentication configuration
const TOKEN_HEADER = 'Authorization';
const TOKEN_PREFIX = 'Bearer';
const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: IAuthUser;
    }
  }
}

/**
 * Middleware to authenticate requests using JWT token
 * Implements comprehensive token validation and session management
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers[TOKEN_HEADER.toLowerCase()];
    if (!authHeader || typeof authHeader !== 'string') {
      throw AuthError.unauthorized('No authentication token provided');
    }

    // Validate token format
    if (!authHeader.startsWith(TOKEN_PREFIX)) {
      throw AuthError.invalidToken('Invalid token format');
    }

    // Extract token without Bearer prefix
    const token = authHeader.slice(TOKEN_PREFIX.length + 1);
    if (!token) {
      throw AuthError.invalidToken('Empty token provided');
    }

    try {
      // Verify token signature and expiration
      const decoded = await verifyToken(token, 'ACCESS');

      // Validate required user data in token
      if (!decoded.userId || !decoded.role) {
        throw AuthError.invalidToken('Invalid token payload');
      }

      // Create authenticated user object
      const user: IAuthUser = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role as UserRole,
        sessionId: decoded.sessionId,
        lastActive: new Date()
      };

      // Attach user to request object
      req.user = user;

      // Continue to next middleware
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw AuthError.sessionExpired('Authentication session has expired');
      }
      throw AuthError.invalidToken('Invalid authentication token');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Role hierarchy for authorization checks
 * Higher index means higher privileges
 */
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.GUEST,
  UserRole.VIEWER,
  UserRole.EDITOR,
  UserRole.ADMIN,
  UserRole.OWNER
];

/**
 * Middleware factory for role-based authorization
 * Implements role hierarchy checks with detailed error tracking
 */
export const authorize = (allowedRoles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Ensure user is authenticated
      const user = req.user;
      if (!user) {
        throw AuthError.unauthorized('User not authenticated');
      }

      // Get hierarchy levels for comparison
      const userRoleLevel = ROLE_HIERARCHY.indexOf(user.role);
      const minRequiredLevel = Math.min(
        ...allowedRoles.map(role => ROLE_HIERARCHY.indexOf(role))
      );

      // Check if user's role has sufficient privileges
      if (userRoleLevel < minRequiredLevel) {
        throw AuthError.forbidden('Insufficient permissions', {
          requiredRoles: allowedRoles,
          userRole: user.role,
          resourceType: req.baseUrl,
          method: req.method
        });
      }

      // Check session timeout
      const lastActive = user.lastActive?.getTime() || 0;
      if (Date.now() - lastActive > SESSION_TIMEOUT) {
        throw AuthError.sessionExpired('Session has timed out due to inactivity');
      }

      // Update last active timestamp
      user.lastActive = new Date();

      // Authorization successful
      next();
    } catch (error) {
      next(error);
    }
  };
};