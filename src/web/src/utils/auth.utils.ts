/**
 * @fileoverview Comprehensive utility functions for secure authentication token management,
 * session validation, and token lifecycle handling with enhanced security features
 * @version 1.0.0
 */

import jwtDecode from 'jwt-decode'; // jwt-decode ^4.0.0
import { AuthTokens, AuthSession, UserRole, MFAType } from '../types/auth.types';

// Constants for token management
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRY_BUFFER = 300; // 5 minutes buffer for token expiry
const MAX_REFRESH_ATTEMPTS = 3;
const REFRESH_RETRY_DELAY = 1000; // 1 second base delay for exponential backoff

/**
 * Securely stores authentication tokens in local storage with validation
 * @param {AuthTokens} tokens - Token pair to store
 * @throws {Error} If tokens are invalid or storage fails
 */
export const storeTokens = (tokens: AuthTokens): void => {
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    throw new Error('Invalid token structure');
  }

  try {
    // Validate token format and structure before storage
    if (!isTokenValid(tokens.accessToken)) {
      throw new Error('Invalid access token format');
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);

    // Log token storage for security audit (implement based on logging strategy)
    console.debug('Auth tokens stored successfully');
  } catch (error) {
    console.error('Failed to store auth tokens:', error);
    clearTokens(); // Clear any partial token storage
    throw new Error('Token storage failed');
  }
};

/**
 * Securely retrieves and validates stored authentication tokens
 * @returns {AuthTokens | null} Validated token pair or null if invalid/not found
 */
export const getStoredTokens = (): AuthTokens | null => {
  try {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (!accessToken || !refreshToken) {
      return null;
    }

    // Validate retrieved tokens
    if (!isTokenValid(accessToken)) {
      clearTokens();
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: getTokenExpiration(accessToken),
      tokenType: 'Bearer'
    };
  } catch (error) {
    console.error('Failed to retrieve auth tokens:', error);
    clearTokens();
    return null;
  }
};

/**
 * Securely removes stored authentication tokens and session data
 */
export const clearTokens = (): void => {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    // Clear any additional session-related data
    console.debug('Auth tokens cleared successfully');
  } catch (error) {
    console.error('Failed to clear auth tokens:', error);
  }
};

/**
 * Comprehensively validates token structure, expiration, and security requirements
 * @param {string} token - JWT token to validate
 * @returns {boolean} True if token is valid and not expired
 */
export const isTokenValid = (token: string): boolean => {
  try {
    if (!token) return false;

    const decoded = jwtDecode<{ exp: number }>(token);
    if (!decoded?.exp) return false;

    // Check token expiration with buffer
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp > (currentTime + TOKEN_EXPIRY_BUFFER);
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
};

/**
 * Securely refreshes authentication session with retry mechanism
 * @returns {Promise<AuthSession>} New session data with enhanced security information
 */
export const refreshSession = async (): Promise<AuthSession> => {
  let attempts = 0;
  
  const attemptRefresh = async (): Promise<AuthSession> => {
    try {
      const tokens = getStoredTokens();
      if (!tokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Implement refresh token API call here
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const newTokens: AuthTokens = await response.json();
      storeTokens(newTokens);

      return parseSession(newTokens.accessToken);
    } catch (error) {
      if (attempts < MAX_REFRESH_ATTEMPTS) {
        attempts++;
        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, REFRESH_RETRY_DELAY * Math.pow(2, attempts - 1))
        );
        return attemptRefresh();
      }
      throw new Error('Session refresh failed after maximum attempts');
    }
  };

  return attemptRefresh();
};

/**
 * Parses JWT token to extract comprehensive session information
 * @param {string} token - JWT access token to parse
 * @returns {AuthSession} Enhanced session data including security information
 */
export const parseSession = (token: string): AuthSession => {
  try {
    const decoded = jwtDecode<{
      sub: string;
      role: UserRole;
      exp: number;
      ip: string;
      ua: string;
      mfa: boolean;
    }>(token);

    if (!decoded?.sub || !decoded?.role) {
      throw new Error('Invalid token payload');
    }

    return {
      userId: decoded.sub,
      role: decoded.role,
      expiresAt: decoded.exp * 1000, // Convert to milliseconds
      ipAddress: decoded.ip,
      userAgent: decoded.ua,
      mfaVerified: decoded.mfa,
      lastActivity: Date.now()
    };
  } catch (error) {
    console.error('Failed to parse session data:', error);
    throw new Error('Invalid session token');
  }
};

/**
 * Helper function to extract token expiration time
 * @param {string} token - JWT token
 * @returns {number} Token expiration time in seconds
 */
const getTokenExpiration = (token: string): number => {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp - currentTime;
  } catch {
    return 0;
  }
};