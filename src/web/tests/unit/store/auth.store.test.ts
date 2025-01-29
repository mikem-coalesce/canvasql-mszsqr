/**
 * @fileoverview Comprehensive test suite for authentication store with enhanced security features
 * @version 1.0.0
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../../../src/store/auth.store';
import AuthService from '../../../src/services/auth.service';
import { isTokenValid, parseSession, validateSecurityLevel } from '../../../src/utils/auth.utils';
import { SecurityLevel, UserRole, MFAType } from '../../../src/types/auth.types';

// Mock AuthService
vi.mock('../../../src/services/auth.service', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    verifyMFA: vi.fn(),
    refreshAuthSession: vi.fn(),
    getCurrentUser: vi.fn()
  }
}));

// Mock auth utilities
vi.mock('../../../src/utils/auth.utils', () => ({
  isTokenValid: vi.fn(),
  parseSession: vi.fn(),
  validateSecurityLevel: vi.fn()
}));

describe('useAuthStore', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset store to initial state
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.logout();
    });
    
    // Clear localStorage
    localStorage.clear();
    
    // Reset mock implementations
    (isTokenValid as any).mockImplementation(() => true);
    (parseSession as any).mockImplementation(() => ({
      userId: 'test-user-id',
      role: UserRole.EDITOR,
      expiresAt: Date.now() + 3600000,
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      mfaVerified: false,
      lastActivity: Date.now()
    }));
    (validateSecurityLevel as any).mockImplementation(() => true);
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore());
      
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.mfaVerified).toBe(false);
      expect(result.current.securityLevel).toBe(SecurityLevel.INTERNAL);
      expect(result.current.failedAttempts).toBe(0);
      expect(result.current.isLocked).toBe(false);
    });
  });

  describe('login', () => {
    const mockCredentials = {
      email: 'test@example.com',
      password: 'Test123!@#'
    };

    const mockLoginResponse = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        role: UserRole.EDITOR
      },
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token'
    };

    it('should handle successful login', async () => {
      (AuthService.login as any).mockResolvedValue(mockLoginResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login(mockCredentials);
      });

      expect(result.current.user).toEqual(mockLoginResponse.user);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.failedAttempts).toBe(0);
    });

    it('should handle login with MFA requirement', async () => {
      const mfaResponse = {
        ...mockLoginResponse,
        mfaRequired: true,
        mfaType: MFAType.TOTP
      };
      (AuthService.login as any).mockResolvedValue(mfaResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login(mockCredentials);
      });

      expect(result.current.mfaVerified).toBe(false);
      expect(result.current.user).toEqual(mfaResponse.user);
    });

    it('should handle login failure with rate limiting', async () => {
      (AuthService.login as any).mockRejectedValue(new Error('Invalid credentials'));

      const { result } = renderHook(() => useAuthStore());

      for (let i = 0; i < 5; i++) {
        await act(async () => {
          try {
            await result.current.login(mockCredentials);
          } catch (error) {
            // Expected error
          }
        });
      }

      expect(result.current.failedAttempts).toBe(5);
      expect(result.current.isLocked).toBe(true);
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('session management', () => {
    it('should handle session refresh', async () => {
      const mockSession = {
        userId: 'test-user-id',
        role: UserRole.EDITOR,
        expiresAt: Date.now() + 3600000,
        mfaVerified: true
      };
      (AuthService.refreshAuthSession as any).mockResolvedValue(mockSession);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(result.current.session).toEqual(mockSession);
      expect(result.current.loading).toBe(false);
    });

    it('should handle session expiration', async () => {
      (isTokenValid as any).mockImplementation(() => false);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.checkAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  describe('security features', () => {
    it('should handle MFA verification', async () => {
      const mockMfaToken = '123456';
      (AuthService.verifyMFA as any).mockResolvedValue({ verified: true });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.verifyMFA(mockMfaToken, MFAType.TOTP);
      });

      expect(result.current.mfaVerified).toBe(true);
    });

    it('should track security level changes', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        result.current.updateSecurityLevel(SecurityLevel.SENSITIVE);
      });

      expect(result.current.securityLevel).toBe(SecurityLevel.SENSITIVE);
    });

    it('should handle security violations', async () => {
      (validateSecurityLevel as any).mockImplementation(() => false);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        result.current.updateSecurityLevel(SecurityLevel.CRITICAL);
      });

      expect(result.current.securityLevel).not.toBe(SecurityLevel.CRITICAL);
    });
  });

  describe('logout', () => {
    it('should handle logout and clear state', async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.mfaVerified).toBe(false);
      expect(result.current.failedAttempts).toBe(0);
      expect(result.current.isLocked).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle and clear errors', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.setError('Test error');
      });
      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });

    it('should reset failed attempts', () => {
      const { result } = renderHook(() => useAuthStore());

      act(() => {
        for (let i = 0; i < 3; i++) {
          result.current.handleFailedAttempt();
        }
      });
      expect(result.current.failedAttempts).toBe(3);

      act(() => {
        result.current.resetFailedAttempts();
      });
      expect(result.current.failedAttempts).toBe(0);
      expect(result.current.isLocked).toBe(false);
    });
  });
});