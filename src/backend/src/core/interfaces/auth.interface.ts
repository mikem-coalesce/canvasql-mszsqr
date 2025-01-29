/**
 * Authentication and Authorization Interfaces
 * @version 1.0.0
 * @description Core interfaces for authentication flow, session management and role-based access control
 */

/**
 * User role enumeration defining authorization levels and access permissions
 * Roles are hierarchical with descending privileges from OWNER to GUEST
 */
export enum UserRole {
  OWNER = 'OWNER',     // Full system access including user management
  ADMIN = 'ADMIN',     // Full access except user management
  EDITOR = 'EDITOR',   // Edit access to assigned workspaces
  VIEWER = 'VIEWER',   // Read-only access to assigned workspaces
  GUEST = 'GUEST'      // Limited access to shared resources only
}

/**
 * Interface representing an authenticated user with role and metadata
 */
export interface IAuthUser {
  /** Unique user identifier */
  id: string;
  
  /** User email address used for authentication */
  email: string;
  
  /** User's assigned role determining access permissions */
  role: UserRole;
  
  /** Flag indicating if multi-factor authentication is enabled */
  mfaEnabled: boolean;
  
  /** Timestamp of user's last successful login */
  lastLoginAt: Date;
  
  /** Account creation timestamp */
  createdAt: Date;
  
  /** Last account update timestamp */
  updatedAt: Date;
}

/**
 * Interface for authentication credentials during login
 */
export interface IAuthCredentials {
  /** User email address */
  email: string;
  
  /** User password (should be hashed before transmission) */
  password: string;
  
  /** Optional MFA token for two-factor authentication */
  mfaToken?: string;
}

/**
 * Interface for JWT token pair response after successful authentication
 */
export interface IAuthTokens {
  /** Short-lived JWT access token */
  accessToken: string;
  
  /** Long-lived JWT refresh token */
  refreshToken: string;
  
  /** Access token expiration time in seconds */
  expiresIn: number;
  
  /** Token type identifier (usually "Bearer") */
  tokenType: string;
}

/**
 * Interface for Redis session data structure
 * Tracks user session state and activity for security monitoring
 */
export interface IAuthSession {
  /** Associated user identifier */
  userId: string;
  
  /** User's current role */
  role: UserRole;
  
  /** Session expiration timestamp (Unix ms) */
  expiresAt: number;
  
  /** Session creation timestamp (Unix ms) */
  createdAt: number;
  
  /** Last activity timestamp (Unix ms) */
  lastActivityAt: number;
  
  /** Client IP address for session tracking */
  ipAddress: string;
  
  /** Client user agent string for session tracking */
  userAgent: string;
}