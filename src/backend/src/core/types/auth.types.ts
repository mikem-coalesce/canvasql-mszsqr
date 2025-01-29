/**
 * Type definitions for authentication, authorization and session management
 * using Auth.js with JWT tokens and role-based access control
 * @version 1.0.0
 */

/**
 * User role types for role-based access control
 * Defines permission levels for workspace and project access
 */
export enum UserRole {
  OWNER = 'OWNER',     // Full access including user management
  ADMIN = 'ADMIN',     // Full access except user management
  EDITOR = 'EDITOR',   // Can edit but not create/delete
  VIEWER = 'VIEWER',   // Read-only access
  GUEST = 'GUEST'      // Limited access to shared resources
}

/**
 * JWT token types for access and refresh tokens
 * Used to differentiate between short-lived access tokens and
 * long-lived refresh tokens
 */
export enum TokenType {
  ACCESS = 'ACCESS',     // Short-lived access token (1 hour)
  REFRESH = 'REFRESH'    // Long-lived refresh token (7 days)
}

/**
 * JWT token payload structure containing user data and expiration
 * Follows JWT standard fields plus custom claims for user data
 */
export interface TokenPayload {
  userId: string;        // Unique user identifier
  email: string;         // User email address
  role: UserRole;        // User's role for RBAC
  type: TokenType;       // Token type (access/refresh)
  exp: number;          // Token expiration timestamp
  iat: number;          // Token issued at timestamp
}

/**
 * Authentication token response structure
 * Contains both access and refresh tokens with expiration
 */
export interface AuthTokens {
  accessToken: string;   // JWT access token
  refreshToken: string;  // JWT refresh token
  expiresIn: number;    // Access token expiration in seconds
}

/**
 * User login credentials structure
 * Used for authentication requests
 */
export interface AuthCredentials {
  email: string;        // User email address
  password: string;     // User password (plain text for transport only)
}

/**
 * Redis session data structure with TTL
 * Stores minimal session data for active users
 */
export interface AuthSession {
  userId: string;       // User identifier
  role: UserRole;       // User role for quick access checks
  expiresAt: number;   // Session expiration timestamp
}