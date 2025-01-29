/**
 * @fileoverview Service class for handling authentication operations with enhanced security features
 * @version 1.0.0
 */

import axiosInstance, { getStoredTokens, clearStoredTokens, setStoredTokens } from '../lib/axios';
import type { AuthUser, AuthCredentials, AuthTokens, AuthSession, AuthError } from '../types/auth.types';

/**
 * Tracks user session activity and security context
 */
class SessionTracker {
  private lastActivity: number;
  private sessionTimeout: number;
  private activityInterval: NodeJS.Timeout | null;

  constructor() {
    this.lastActivity = Date.now();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.activityInterval = null;
  }

  /**
   * Starts session activity monitoring
   */
  startTracking(): void {
    this.activityInterval = setInterval(() => {
      const inactiveTime = Date.now() - this.lastActivity;
      if (inactiveTime > this.sessionTimeout) {
        this.endSession();
      }
    }, 60000); // Check every minute
  }

  /**
   * Updates last activity timestamp
   */
  updateActivity(): void {
    this.lastActivity = Date.now();
  }

  /**
   * Ends session and cleans up
   */
  endSession(): void {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
    clearStoredTokens();
  }
}

/**
 * Service class for handling authentication operations with enhanced security features
 */
export class AuthService {
  private baseUrl: string;
  private tokenRefreshTimeout: number;
  private maxRetryAttempts: number;
  private sessionTracker: SessionTracker;

  constructor() {
    this.baseUrl = '/auth';
    this.tokenRefreshTimeout = 3540000; // 59 minutes (1 minute before token expiry)
    this.maxRetryAttempts = 3;
    this.sessionTracker = new SessionTracker();
  }

  /**
   * Authenticates user with credentials and establishes secure session
   */
  async login(credentials: AuthCredentials): Promise<AuthTokens> {
    try {
      const response = await axiosInstance.post<{ tokens: AuthTokens; user: AuthUser }>(
        `${this.baseUrl}/login`,
        credentials,
        {
          headers: {
            'X-Request-Source': 'web-client',
            'X-Request-Timestamp': Date.now().toString()
          }
        }
      );

      const { tokens, user } = response.data;

      // Validate token structure
      if (!tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Invalid token response');
      }

      // Store tokens securely
      setStoredTokens(tokens);

      // Initialize session tracking
      this.sessionTracker.startTracking();

      // Set up token refresh
      this.scheduleTokenRefresh();

      return tokens;
    } catch (error: any) {
      await this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Registers new user account with secure password handling
   */
  async register(credentials: AuthCredentials): Promise<AuthTokens> {
    try {
      const response = await axiosInstance.post<{ tokens: AuthTokens; user: AuthUser }>(
        `${this.baseUrl}/register`,
        credentials,
        {
          headers: {
            'X-Request-Source': 'web-client',
            'X-Request-Timestamp': Date.now().toString()
          }
        }
      );

      const { tokens, user } = response.data;

      // Validate and store tokens
      if (!tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Invalid token response');
      }

      setStoredTokens(tokens);
      this.sessionTracker.startTracking();
      this.scheduleTokenRefresh();

      return tokens;
    } catch (error: any) {
      await this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Securely terminates user session and cleans up
   */
  async logout(): Promise<void> {
    try {
      const tokens = getStoredTokens();
      if (tokens) {
        await axiosInstance.post(`${this.baseUrl}/logout`, null, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        });
      }
    } finally {
      this.sessionTracker.endSession();
      clearStoredTokens();
    }
  }

  /**
   * Retrieves current authenticated user with session validation
   */
  async getCurrentUser(): Promise<AuthUser> {
    try {
      const tokens = getStoredTokens();
      if (!tokens) {
        throw new Error('No active session');
      }

      const response = await axiosInstance.get<{ user: AuthUser }>(
        `${this.baseUrl}/me`,
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        }
      );

      this.sessionTracker.updateActivity();
      return response.data.user;
    } catch (error: any) {
      await this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Refreshes authentication session with token rotation
   */
  private async refreshAuthSession(): Promise<AuthSession> {
    try {
      const tokens = getStoredTokens();
      if (!tokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axiosInstance.post<{ tokens: AuthTokens; session: AuthSession }>(
        `${this.baseUrl}/refresh`,
        {
          refreshToken: tokens.refreshToken
        }
      );

      const { tokens: newTokens, session } = response.data;

      // Validate and store new tokens
      if (!newTokens.accessToken || !newTokens.refreshToken) {
        throw new Error('Invalid token refresh response');
      }

      setStoredTokens(newTokens);
      this.scheduleTokenRefresh();
      this.sessionTracker.updateActivity();

      return session;
    } catch (error: any) {
      await this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Schedules automatic token refresh before expiry
   */
  private scheduleTokenRefresh(): void {
    setTimeout(() => {
      this.refreshAuthSession().catch(error => {
        console.error('Token refresh failed:', error);
        this.sessionTracker.endSession();
      });
    }, this.tokenRefreshTimeout);
  }

  /**
   * Handles authentication errors with retry logic
   */
  private async handleAuthError(error: AuthError): Promise<void> {
    if (error.response?.status === 401) {
      // Token expired - attempt refresh
      try {
        await this.refreshAuthSession();
      } catch (refreshError) {
        this.sessionTracker.endSession();
        throw refreshError;
      }
    } else if (error.response?.status === 403) {
      // Permission denied
      this.sessionTracker.endSession();
      throw new Error('Access denied');
    } else {
      // Other errors
      console.error('Authentication error:', error);
      throw error;
    }
  }
}

export default new AuthService();