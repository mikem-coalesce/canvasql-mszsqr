/**
 * @fileoverview Configures and exports a customized Axios instance with comprehensive security,
 * monitoring, and error handling features for API communication.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.5.0
import CryptoJS from 'crypto-js'; // ^4.1.1
import type { APIError, APIHeaders, APIResponse } from '../types/api.types';
import type { AuthTokens, TokenResponse } from '../types/auth.types';

// API Configuration Constants
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const API_TIMEOUT = 30000;
const TOKEN_STORAGE_KEY = 'auth_tokens';
const MAX_RETRY_ATTEMPTS = 3;
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_INTERVAL = 60000;

/**
 * Token management utility for secure token handling and rotation
 */
const tokenManager = {
  private: {
    tokens: null as AuthTokens | null,
    refreshPromise: null as Promise<TokenResponse> | null,
  },

  /**
   * Securely stores authentication tokens with encryption
   */
  setTokens(tokens: AuthTokens): void {
    this.private.tokens = tokens;
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(tokens),
      window.location.hostname
    ).toString();
    localStorage.setItem(TOKEN_STORAGE_KEY, encrypted);
  },

  /**
   * Retrieves and decrypts stored authentication tokens
   */
  getTokens(): AuthTokens | null {
    if (this.private.tokens) return this.private.tokens;

    const encrypted = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!encrypted) return null;

    try {
      const decrypted = CryptoJS.AES.decrypt(
        encrypted,
        window.location.hostname
      ).toString(CryptoJS.enc.Utf8);
      this.private.tokens = JSON.parse(decrypted);
      return this.private.tokens;
    } catch (error) {
      console.error('Token decryption failed:', error);
      this.clearTokens();
      return null;
    }
  },

  /**
   * Securely clears stored authentication tokens
   */
  clearTokens(): void {
    this.private.tokens = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  },

  /**
   * Refreshes authentication tokens with automatic retry
   */
  async refreshTokens(): Promise<TokenResponse> {
    if (this.private.refreshPromise) {
      return this.private.refreshPromise;
    }

    this.private.refreshPromise = axiosInstance
      .post<TokenResponse>('/auth/refresh', {
        refreshToken: this.getTokens()?.refreshToken,
      })
      .then((response) => {
        const newTokens = response.data;
        this.setTokens(newTokens);
        this.private.refreshPromise = null;
        return newTokens;
      })
      .catch((error) => {
        this.private.refreshPromise = null;
        this.clearTokens();
        throw error;
      });

    return this.private.refreshPromise;
  },
};

/**
 * Rate limiting implementation using token bucket algorithm
 */
const rateLimiter = {
  tokens: RATE_LIMIT_REQUESTS,
  lastRefill: Date.now(),

  /**
   * Checks if request is within rate limits
   */
  checkLimit(): boolean {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const refillAmount = Math.floor(timePassed / RATE_LIMIT_INTERVAL) * RATE_LIMIT_REQUESTS;

    this.tokens = Math.min(RATE_LIMIT_REQUESTS, this.tokens + refillAmount);
    this.lastRefill = now;

    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  },
};

/**
 * Creates and configures the Axios instance with security features
 */
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Version': 'v1',
  },
});

/**
 * Request interceptor for authentication and security
 */
axiosInstance.interceptors.request.use(
  async (config: AxiosRequestConfig) => {
    // Rate limiting check
    if (!rateLimiter.checkLimit()) {
      throw new Error('Rate limit exceeded');
    }

    // Add security headers
    config.headers = {
      ...config.headers,
      'X-Request-ID': crypto.randomUUID(),
      'X-Request-Timestamp': Date.now().toString(),
    } as APIHeaders;

    // Add authentication token
    const tokens = tokenManager.getTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    // Request signing for integrity
    const signature = CryptoJS.HmacSHA256(
      JSON.stringify(config.data || ''),
      tokens?.accessToken || ''
    ).toString();
    config.headers['X-Request-Signature'] = signature;

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor for error handling and token refresh
 */
axiosInstance.interceptors.response.use(
  (response: AxiosResponse): APIResponse<any> => {
    return {
      success: true,
      data: response.data,
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: response.config.headers['X-Request-ID'],
      },
    };
  },
  async (error) => {
    const originalRequest = error.config;

    // Token refresh handling
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await tokenManager.refreshTokens();
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        tokenManager.clearTokens();
        throw refreshError;
      }
    }

    // Standardized error response
    const apiError: APIError = {
      code: error.response?.data?.code || 'UNKNOWN_ERROR',
      message: error.response?.data?.message || 'An unexpected error occurred',
      details: error.response?.data?.details || {},
      validationErrors: error.response?.data?.validationErrors,
    };

    return Promise.reject({
      success: false,
      data: null,
      error: apiError,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: originalRequest?.headers['X-Request-ID'],
      },
    });
  }
);

export { axiosInstance as default, tokenManager };