/**
 * @fileoverview Comprehensive unit test suite for useAuth hook with security validations
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useAuth from '../../../src/hooks/useAuth';
import AuthService from '../../../src/services/auth.service';
import type { 
  AuthUser, 
  AuthCredentials, 
  AuthSession, 
  MFAType, 
  SecurityLevel 
} from '../../../src/types/auth.types';

// Mock react-router-dom navigation
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));

// Mock AuthService
vi.mock('../../../src/services/auth.service', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    refreshAuthSession: vi.fn(),
    verifyMFA: vi.fn(),
    validateSecurityLevel: vi.fn()
  }
}));

describe('useAuth Hook', () => {
  // Test data setup
  const mockUser: AuthUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'EDITOR',
    mfaEnabled: true,
    mfaType: MFAType.TOTP,
    lastLogin: new Date(),
    failedAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockCredentials: AuthCredentials = {
    email: 'test@example.com',
    password: 'Test123!@#',
    mfaCode: '123456'
  };

  const mockSession: AuthSession = {
    userId: 'test-user-id',
    role: 'EDITOR',
    expiresAt: Date.now() + 3600000,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    mfaVerified: false,
    lastActivity: Date.now()
  };

  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Authentication Flow', () => {
    it('should handle successful login with security validation', async () => {
      // Setup mocks
      const mockAuthResponse = { user: mockUser, session: mockSession };
      (AuthService.login as any).mockResolvedValueOnce(mockAuthResponse);
      (AuthService.validateSecurityLevel as any).mockResolvedValueOnce(true);

      // Render hook
      const { result } = renderHook(() => useAuth());

      // Execute login
      await act(async () => {
        await result.current.login(mockCredentials);
      });

      // Verify security validations
      expect(AuthService.validateSecurityLevel).toHaveBeenCalledWith(SecurityLevel.INTERNAL);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.failedAttempts).toBe(0);
    });

    it('should handle failed login with security monitoring', async () => {
      // Setup mock for failed login
      const error = new Error('Invalid credentials');
      (AuthService.login as any).mockRejectedValueOnce(error);

      // Render hook
      const { result } = renderHook(() => useAuth());

      // Execute failed login
      await act(async () => {
        try {
          await result.current.login(mockCredentials);
        } catch (e) {
          expect(e).toEqual(error);
        }
      });

      // Verify security tracking
      expect(result.current.failedAttempts).toBe(1);
      expect(result.current.error).toBe('Invalid credentials');
    });

    it('should enforce account lockout after max failed attempts', async () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Simulate multiple failed attempts
      const error = new Error('Invalid credentials');
      (AuthService.login as any).mockRejectedValue(error);

      // Execute 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          try {
            await result.current.login(mockCredentials);
          } catch (e) {
            expect(e).toEqual(error);
          }
        });
      }

      // Verify account lockout
      expect(result.current.isLocked).toBe(true);
      expect(result.current.failedAttempts).toBe(5);

      // Attempt login while locked
      await act(async () => {
        try {
          await result.current.login(mockCredentials);
        } catch (e) {
          expect(e.message).toBe('Account is temporarily locked. Please try again later.');
        }
      });
    });

    it('should handle MFA verification flow', async () => {
      // Setup mocks
      const mockMFAResponse = { verified: true };
      (AuthService.verifyMFA as any).mockResolvedValueOnce(mockMFAResponse);

      // Render hook
      const { result } = renderHook(() => useAuth());

      // Execute MFA verification
      await act(async () => {
        await result.current.verifyMFA('123456', MFAType.TOTP);
      });

      // Verify MFA state
      expect(result.current.mfaVerified).toBe(true);
      expect(AuthService.verifyMFA).toHaveBeenCalledWith('123456', MFAType.TOTP);
    });
  });

  describe('Session Management', () => {
    it('should handle session refresh with token rotation', async () => {
      // Setup mocks
      const mockRefreshResponse = { ...mockSession, expiresAt: Date.now() + 3600000 };
      (AuthService.refreshAuthSession as any).mockResolvedValueOnce(mockRefreshResponse);

      // Render hook
      const { result } = renderHook(() => useAuth());

      // Set initial session
      act(() => {
        (result.current as any).session = mockSession;
      });

      // Execute session refresh
      await act(async () => {
        await result.current.checkAuth();
      });

      // Verify session refresh
      expect(AuthService.refreshAuthSession).toHaveBeenCalled();
      expect(result.current.session?.expiresAt).toBe(mockRefreshResponse.expiresAt);
    });

    it('should handle session timeout and cleanup', async () => {
      // Setup mocks
      (AuthService.logout as any).mockResolvedValueOnce();

      // Render hook with expired session
      const { result } = renderHook(() => useAuth());

      // Set expired session
      act(() => {
        (result.current as any).session = {
          ...mockSession,
          expiresAt: Date.now() - 1000
        };
      });

      // Check auth with expired session
      await act(async () => {
        try {
          await result.current.checkAuth();
        } catch (e) {
          expect(e.message).toBe('Session expired');
        }
      });

      // Verify session cleanup
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(AuthService.logout).toHaveBeenCalled();
    });

    it('should track user activity and update last activity timestamp', async () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Record initial timestamp
      const initialTimestamp = result.current.lastActivity;

      // Simulate user activity
      await act(async () => {
        result.current.trackActivity();
      });

      // Verify activity tracking
      expect(result.current.lastActivity).toBeGreaterThan(initialTimestamp);
    });
  });

  describe('Security Features', () => {
    it('should handle security level changes with validation', async () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Update security level
      await act(async () => {
        result.current.updateSecurityLevel(SecurityLevel.SENSITIVE);
      });

      // Verify security level update
      expect(result.current.securityLevel).toBe(SecurityLevel.SENSITIVE);
    });

    it('should clear sensitive data on logout', async () => {
      // Setup mocks
      (AuthService.logout as any).mockResolvedValueOnce();

      // Render hook with authenticated state
      const { result } = renderHook(() => useAuth());

      // Set initial authenticated state
      act(() => {
        (result.current as any).user = mockUser;
        (result.current as any).session = mockSession;
        (result.current as any).mfaVerified = true;
      });

      // Execute logout
      await act(async () => {
        await result.current.logout();
      });

      // Verify data cleanup
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.mfaVerified).toBe(false);
      expect(result.current.failedAttempts).toBe(0);
    });

    it('should handle security breach detection and response', async () => {
      // Setup mocks for security breach scenario
      const securityError = new Error('Security breach detected');
      (AuthService.getCurrentUser as any).mockRejectedValueOnce(securityError);

      // Render hook
      const { result } = renderHook(() => useAuth());

      // Attempt auth check
      await act(async () => {
        try {
          await result.current.checkAuth();
        } catch (e) {
          expect(e).toEqual(securityError);
        }
      });

      // Verify security response
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.error).toBe('Security breach detected');
    });
  });
});