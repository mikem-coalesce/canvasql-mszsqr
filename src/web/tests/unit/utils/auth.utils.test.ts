import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  storeTokens,
  getStoredTokens,
  clearTokens,
  isTokenValid,
  refreshSession,
  parseSession
} from '../../../src/utils/auth.utils';
import type {
  AuthTokens,
  AuthSession,
  UserRole
} from '../../../src/types/auth.types';

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key],
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch for refreshSession tests
global.fetch = vi.fn();

// Test data
const mockValidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6IkVESVRPUiIsImV4cCI6OTk5OTk5OTk5OSwiaXAiOiIxMjcuMC4wLjEiLCJ1YSI6Im1vY2siLCJtZmEiOnRydWV9';
const mockExpiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6IkVESVRPUiIsImV4cCI6MTY4MDAwMDAwMCwiaXAiOiIxMjcuMC4wLjEiLCJ1YSI6Im1vY2siLCJtZmEiOnRydWV9';
const mockRefreshToken = 'refresh_token_mock';

describe('storeTokens', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should store valid tokens successfully', () => {
    const tokens: AuthTokens = {
      accessToken: mockValidToken,
      refreshToken: mockRefreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer'
    };

    storeTokens(tokens);
    expect(localStorage.getItem('access_token')).toBe(mockValidToken);
    expect(localStorage.getItem('refresh_token')).toBe(mockRefreshToken);
  });

  it('should throw error for invalid token structure', () => {
    const invalidTokens = { accessToken: '', refreshToken: '' } as AuthTokens;
    expect(() => storeTokens(invalidTokens)).toThrow('Invalid token structure');
  });

  it('should clear partial storage on failure', () => {
    const invalidTokens = { accessToken: 'invalid', refreshToken: mockRefreshToken } as AuthTokens;
    expect(() => storeTokens(invalidTokens)).toThrow();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });
});

describe('getStoredTokens', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should retrieve valid stored tokens', () => {
    const tokens: AuthTokens = {
      accessToken: mockValidToken,
      refreshToken: mockRefreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer'
    };
    storeTokens(tokens);

    const retrieved = getStoredTokens();
    expect(retrieved).toBeTruthy();
    expect(retrieved?.accessToken).toBe(mockValidToken);
    expect(retrieved?.refreshToken).toBe(mockRefreshToken);
  });

  it('should return null for missing tokens', () => {
    expect(getStoredTokens()).toBeNull();
  });

  it('should clear and return null for invalid tokens', () => {
    localStorage.setItem('access_token', 'invalid_token');
    localStorage.setItem('refresh_token', mockRefreshToken);
    
    expect(getStoredTokens()).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });
});

describe('clearTokens', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should clear all stored tokens', () => {
    localStorage.setItem('access_token', mockValidToken);
    localStorage.setItem('refresh_token', mockRefreshToken);
    
    clearTokens();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('should handle clearing already empty storage', () => {
    expect(() => clearTokens()).not.toThrow();
  });
});

describe('isTokenValid', () => {
  it('should validate unexpired token', () => {
    expect(isTokenValid(mockValidToken)).toBe(true);
  });

  it('should invalidate expired token', () => {
    expect(isTokenValid(mockExpiredToken)).toBe(false);
  });

  it('should handle invalid token format', () => {
    expect(isTokenValid('invalid_token')).toBe(false);
  });

  it('should handle empty token', () => {
    expect(isTokenValid('')).toBe(false);
  });
});

describe('refreshSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('should successfully refresh session', async () => {
    const mockResponse = {
      accessToken: mockValidToken,
      refreshToken: 'new_refresh_token',
      expiresIn: 3600,
      tokenType: 'Bearer'
    };

    // Setup stored tokens
    localStorage.setItem('refresh_token', mockRefreshToken);
    
    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const session = await refreshSession();
    expect(session).toBeTruthy();
    expect(session.role).toBe(UserRole.EDITOR);
    expect(session.mfaVerified).toBe(true);
  });

  it('should retry on temporary failure', async () => {
    localStorage.setItem('refresh_token', mockRefreshToken);

    // Mock failed then successful response
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: mockValidToken,
          refreshToken: 'new_refresh_token',
          expiresIn: 3600,
          tokenType: 'Bearer'
        })
      });

    const session = await refreshSession();
    expect(session).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw error after max retry attempts', async () => {
    localStorage.setItem('refresh_token', mockRefreshToken);

    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    await expect(refreshSession()).rejects.toThrow('Session refresh failed after maximum attempts');
    expect(global.fetch).toHaveBeenCalledTimes(3); // MAX_REFRESH_ATTEMPTS
  });
});

describe('parseSession', () => {
  it('should parse valid session token', () => {
    const session = parseSession(mockValidToken);
    expect(session).toEqual({
      userId: '1234567890',
      role: UserRole.EDITOR,
      expiresAt: 9999999999000,
      ipAddress: '127.0.0.1',
      userAgent: 'mock',
      mfaVerified: true,
      lastActivity: expect.any(Number)
    });
  });

  it('should throw error for invalid token payload', () => {
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnZhbGlkIjoidG9rZW4ifQ';
    expect(() => parseSession(invalidToken)).toThrow('Invalid token payload');
  });

  it('should throw error for malformed token', () => {
    expect(() => parseSession('invalid_token')).toThrow('Invalid session token');
  });
});