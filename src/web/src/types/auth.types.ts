/**
 * @fileoverview Type definitions for authentication, authorization and user management
 * @version 1.0.0
 */

import type { User } from "@auth/core" // @auth/core ^0.18.0

/**
 * Enum defining user role types for role-based access control (RBAC)
 */
export enum UserRole {
  OWNER = "OWNER",     // Full system access including user management
  ADMIN = "ADMIN",     // Full access except user management
  EDITOR = "EDITOR",   // Edit access to assigned resources
  VIEWER = "VIEWER",   // Read-only access to assigned resources
  GUEST = "GUEST"      // Limited access to shared resources
}

/**
 * Enum defining supported Multi-Factor Authentication types
 */
export enum MFAType {
  TOTP = "TOTP",       // Time-based One-Time Password
  EMAIL = "EMAIL"      // Email verification code
}

/**
 * Interface extending Auth.js User with additional security properties
 */
export interface AuthUser extends User {
  id: string;                  // Unique user identifier
  email: string;              // User email address
  role: UserRole;             // User's assigned role
  mfaEnabled: boolean;        // Whether MFA is enabled
  mfaType: MFAType;          // Type of MFA if enabled
  lastLogin: Date;           // Timestamp of last successful login
  failedAttempts: number;    // Count of failed login attempts
  createdAt: Date;          // Account creation timestamp
  updatedAt: Date;          // Last account update timestamp
}

/**
 * Interface for authentication credentials including MFA support
 */
export interface AuthCredentials {
  email: string;             // User email
  password: string;          // User password
  mfaCode?: string;         // Optional MFA verification code
}

/**
 * Interface for JWT token pair response
 */
export interface AuthTokens {
  accessToken: string;       // JWT access token
  refreshToken: string;      // JWT refresh token
  expiresIn: number;        // Access token expiration in seconds
  tokenType: string;        // Token type (usually "Bearer")
}

/**
 * Interface for session data with security tracking
 */
export interface AuthSession {
  userId: string;           // Associated user ID
  role: UserRole;          // User's role for session
  expiresAt: number;       // Session expiration timestamp
  ipAddress: string;       // Client IP address
  userAgent: string;       // Client user agent string
  mfaVerified: boolean;    // MFA verification status
  lastActivity: number;    // Last activity timestamp
}

/**
 * Type for workspace-level permissions based on user role
 */
export type WorkspacePermissions = {
  [key in UserRole]: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    share: boolean;
    manage: boolean;
  }
}

/**
 * Type for project-level permissions based on user role
 */
export type ProjectPermissions = {
  [key in UserRole]: {
    view: boolean;
    edit: boolean;
    comment: boolean;
    share: boolean;
    export: boolean;
  }
}

/**
 * Type for diagram-level permissions based on user role
 */
export type DiagramPermissions = {
  [key in UserRole]: {
    view: boolean;
    edit: boolean;
    comment: boolean;
    download: boolean;
  }
}