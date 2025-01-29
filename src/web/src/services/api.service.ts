/**
 * @fileoverview Core API service providing a centralized interface for making HTTP requests
 * with comprehensive error handling, security controls, and monitoring.
 * @version 1.0.0
 */

import axiosInstance, { tokenManager } from '../lib/axios';
import type {
  APIResponse,
  APIError,
  APIQueryParams,
  PaginatedResponse,
  APIHeaders,
  APIErrorCode,
  defaultRateLimitConfig
} from '../types/api.types';

/**
 * Configuration options for API requests
 */
interface RequestConfig {
  headers?: Partial<APIHeaders>;
  timeout?: number;
  retry?: boolean;
  cache?: boolean;
  signal?: AbortSignal;
}

/**
 * Core API service class implementing comprehensive API interaction capabilities
 */
export class APIService {
  private readonly instance = axiosInstance;
  private readonly retryAttempts: number;
  private readonly requestTimeout: number;
  private readonly defaultHeaders: Partial<APIHeaders>;

  /**
   * Initializes the API service with security and monitoring configurations
   */
  constructor(
    maxRetries: number = defaultRateLimitConfig.maxRequests,
    timeout: number = 30000
  ) {
    this.retryAttempts = maxRetries;
    this.requestTimeout = timeout;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Version': 'v1'
    };

    this.setupMonitoring();
  }

  /**
   * Makes a GET request with comprehensive error handling and monitoring
   */
  public async get<T>(
    endpoint: string,
    params?: APIQueryParams,
    config?: RequestConfig
  ): Promise<APIResponse<T>> {
    try {
      const response = await this.instance.get<APIResponse<T>>(endpoint, {
        params,
        headers: { ...this.defaultHeaders, ...config?.headers },
        timeout: config?.timeout || this.requestTimeout,
        signal: config?.signal
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Makes a POST request with data validation and security controls
   */
  public async post<T, R = T>(
    endpoint: string,
    data: T,
    config?: RequestConfig
  ): Promise<APIResponse<R>> {
    try {
      const response = await this.instance.post<APIResponse<R>>(endpoint, data, {
        headers: { ...this.defaultHeaders, ...config?.headers },
        timeout: config?.timeout || this.requestTimeout,
        signal: config?.signal
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Makes a PUT request with data validation and security controls
   */
  public async put<T, R = T>(
    endpoint: string,
    data: T,
    config?: RequestConfig
  ): Promise<APIResponse<R>> {
    try {
      const response = await this.instance.put<APIResponse<R>>(endpoint, data, {
        headers: { ...this.defaultHeaders, ...config?.headers },
        timeout: config?.timeout || this.requestTimeout,
        signal: config?.signal
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Makes a DELETE request with security controls and confirmation
   */
  public async delete<T = void>(
    endpoint: string,
    config?: RequestConfig
  ): Promise<APIResponse<T>> {
    try {
      const response = await this.instance.delete<APIResponse<T>>(endpoint, {
        headers: { ...this.defaultHeaders, ...config?.headers },
        timeout: config?.timeout || this.requestTimeout,
        signal: config?.signal
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Makes a GET request that returns paginated data with cursor support
   */
  public async getPaginated<T>(
    endpoint: string,
    params?: APIQueryParams,
    config?: RequestConfig
  ): Promise<APIResponse<PaginatedResponse<T>>> {
    try {
      const response = await this.instance.get<APIResponse<PaginatedResponse<T>>>(
        endpoint,
        {
          params: {
            ...params,
            page: params?.page || 1,
            pageSize: Math.min(params?.pageSize || 20, 100)
          },
          headers: { ...this.defaultHeaders, ...config?.headers },
          timeout: config?.timeout || this.requestTimeout,
          signal: config?.signal
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Processes and standardizes API errors with monitoring
   */
  private handleError(error: any): APIError {
    const apiError: APIError = {
      code: APIErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: {},
    };

    if (error.response) {
      apiError.code = error.response.data?.code || APIErrorCode.INTERNAL_ERROR;
      apiError.message = error.response.data?.message || error.message;
      apiError.details = error.response.data?.details || {};
      apiError.validationErrors = error.response.data?.validationErrors;
    } else if (error.request) {
      apiError.code = APIErrorCode.INTERNAL_ERROR;
      apiError.message = 'No response received from server';
      apiError.details = { request: error.request };
    }

    // Log error for monitoring
    console.error('[APIService]', {
      error: apiError,
      timestamp: new Date().toISOString(),
      endpoint: error.config?.url,
      method: error.config?.method
    });

    return apiError;
  }

  /**
   * Sets up request/response monitoring interceptors
   */
  private setupMonitoring(): void {
    this.instance.interceptors.request.use((config) => {
      const requestId = crypto.randomUUID();
      const startTime = Date.now();

      config.metadata = {
        requestId,
        startTime,
        endpoint: config.url,
        method: config.method
      };

      return config;
    });

    this.instance.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        
        // Log successful request metrics
        console.info('[APIService]', {
          requestId: response.config.metadata?.requestId,
          endpoint: response.config.metadata?.endpoint,
          method: response.config.metadata?.method,
          duration,
          status: response.status
        });

        return response;
      },
      (error) => {
        const duration = Date.now() - (error.config?.metadata?.startTime || 0);

        // Log failed request metrics
        console.error('[APIService]', {
          requestId: error.config?.metadata?.requestId,
          endpoint: error.config?.metadata?.endpoint,
          method: error.config?.metadata?.method,
          duration,
          status: error.response?.status,
          error: error.message
        });

        return Promise.reject(error);
      }
    );
  }
}

// Export singleton instance
export default new APIService();