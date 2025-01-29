/**
 * @fileoverview Zustand store for authentication state management with enhanced security features
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import AuthService from '../services/auth.service';
import { 
  AuthUser, 
  AuthCredentials, 
  AuthSession, 
  MFAType, 
  SecurityLevel 
} from '../types/auth.types';
import { 
  isTokenValid, 
  parseSession, 
  validateSecurityLevel 
} from '../utils/auth.utils';

// Constants for security configuration
const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds
const MAX_FAILED_ATTEMPTS = 5;
const authService = new AuthService();

/**
 * Interface defining authentication store state with enhanced security tracking
 */
interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  mfaVerified: boolean;
  securityLevel: SecurityLevel;
  lastActivity: number;
  failedAttempts: number;
  sessionTimeout: number;
  isLocked: boolean;
}

/**
 * Interface defining authentication store actions with security operations
 */
interface AuthActions {
  login: (credentials: AuthCredentials) => Promise<void>;
  register: (credentials: AuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshSession: () => Promise<void>;
  verifyMFA: (token: string, type: MFAType) => Promise<void>;
  updateSecurityLevel: (level: SecurityLevel) => void;
  trackActivity: () => void;
  handleFailedAttempt: () => void;
  resetFailedAttempts: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * Zustand store implementation with security-enhanced authentication state
 */
export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        session: null,
        loading: false,
        error: null,
        mfaVerified: false,
        securityLevel: SecurityLevel.INTERNAL,
        lastActivity: Date.now(),
        failedAttempts: 0,
        sessionTimeout: SESSION_TIMEOUT,
        isLocked: false,

        /**
         * Handles user login with security validation and MFA support
         */
        login: async (credentials: AuthCredentials) => {
          try {
            if (get().isLocked) {
              throw new Error('Account is temporarily locked. Please try again later.');
            }

            set({ loading: true, error: null });
            const response = await authService.login(credentials);
            
            if (!response || !isTokenValid(response.accessToken)) {
              throw new Error('Invalid authentication response');
            }

            const session = parseSession(response.accessToken);
            set({
              user: response.user,
              session,
              mfaVerified: false,
              lastActivity: Date.now(),
              failedAttempts: 0
            });
          } catch (error: any) {
            get().handleFailedAttempt();
            set({ error: error.message });
            throw error;
          } finally {
            set({ loading: false });
          }
        },

        /**
         * Handles new user registration with security validation
         */
        register: async (credentials: AuthCredentials) => {
          try {
            set({ loading: true, error: null });
            const response = await authService.register(credentials);
            
            const session = parseSession(response.accessToken);
            set({
              user: response.user,
              session,
              lastActivity: Date.now()
            });
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ loading: false });
          }
        },

        /**
         * Securely terminates user session and cleans up state
         */
        logout: async () => {
          try {
            set({ loading: true });
            await authService.logout();
          } finally {
            set({
              user: null,
              session: null,
              mfaVerified: false,
              loading: false,
              error: null,
              lastActivity: 0,
              failedAttempts: 0
            });
          }
        },

        /**
         * Validates current authentication state and session
         */
        checkAuth: async () => {
          try {
            const { session, lastActivity, sessionTimeout } = get();
            
            if (Date.now() - lastActivity > sessionTimeout) {
              await get().logout();
              throw new Error('Session expired');
            }

            if (!session || !isTokenValid(session.accessToken)) {
              await get().refreshSession();
            }

            const user = await authService.getCurrentUser();
            set({ user, lastActivity: Date.now() });
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          }
        },

        /**
         * Refreshes authentication session with security validation
         */
        refreshSession: async () => {
          try {
            set({ loading: true });
            const session = await authService.refreshAuthSession();
            set({ 
              session,
              lastActivity: Date.now(),
              loading: false 
            });
          } catch (error: any) {
            await get().logout();
            throw error;
          }
        },

        /**
         * Handles MFA verification with type-specific validation
         */
        verifyMFA: async (token: string, type: MFAType) => {
          try {
            set({ loading: true, error: null });
            await authService.verifyMFA(token, type);
            set({ mfaVerified: true, lastActivity: Date.now() });
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ loading: false });
          }
        },

        /**
         * Updates security level with validation
         */
        updateSecurityLevel: (level: SecurityLevel) => {
          if (validateSecurityLevel(level)) {
            set({ securityLevel: level });
          }
        },

        /**
         * Tracks user activity for session management
         */
        trackActivity: () => {
          set({ lastActivity: Date.now() });
        },

        /**
         * Handles failed authentication attempts with account locking
         */
        handleFailedAttempt: () => {
          const currentAttempts = get().failedAttempts + 1;
          set({ 
            failedAttempts: currentAttempts,
            isLocked: currentAttempts >= MAX_FAILED_ATTEMPTS
          });
        },

        /**
         * Resets failed authentication attempts counter
         */
        resetFailedAttempts: () => {
          set({ 
            failedAttempts: 0,
            isLocked: false
          });
        },

        /**
         * Sets error state with message
         */
        setError: (error: string | null) => {
          set({ error });
        },

        /**
         * Clears error state
         */
        clearError: () => {
          set({ error: null });
        }
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          session: state.session,
          securityLevel: state.securityLevel
        })
      }
    )
  )
);