/**
 * @fileoverview Type definitions for API request/response structures and common API interfaces
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import type { AuthTokens, AuthUser } from './auth.types';
import type { DiagramData } from './diagram.types';
import type { Project } from './project.types';
import type { Workspace } from './workspace.types';

// Global API constants
export const API_VERSION = 'v1';
export const API_CONTENT_TYPE = 'application/json';
export const MAX_PAGE_SIZE = 100;
export const API_TIMEOUT = 30000;
export const API_RETRY_ATTEMPTS = 3;

/**
 * Standard API request headers interface
 * Based on API Architecture specifications
 */
export interface APIHeaders {
  Authorization: string;
  'Content-Type': string;
  Accept: string;
  'X-API-Version': string;
  'X-Request-ID': string;
}

/**
 * Common query parameters for API requests
 * Implements pagination, sorting and filtering
 */
export interface APIQueryParams {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search: string;
  filter: string[];
}

/**
 * API validation error details
 * Implements comprehensive error reporting
 */
export interface APIValidationError {
  field: string;
  message: string;
  constraints: any[];
  code: string;
  metadata: Record<string, any>;
}

/**
 * Standard API error response
 * Implements error handling specifications
 */
export interface APIError {
  code: string;
  message: string;
  details: Record<string, any>;
  validationErrors?: APIValidationError[];
}

/**
 * Generic API response wrapper
 * Implements standardized response structure
 */
export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: APIError | null;
  metadata: Record<string, any>;
}

/**
 * Paginated response wrapper
 * Implements pagination specifications
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Helper function to create standardized API responses
 * Implements response structure requirements
 */
export function createAPIResponse<T>(
  data: T | null,
  error: APIError | null = null,
  metadata: Record<string, any> = {}
): APIResponse<T> {
  return {
    success: !error,
    data,
    error,
    metadata
  };
}

// Zod schema for API response validation
export const APIResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().nullable(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()),
    validationErrors: z.array(z.object({
      field: z.string(),
      message: z.string(),
      constraints: z.array(z.any()),
      code: z.string(),
      metadata: z.record(z.any())
    })).optional()
  }).nullable(),
  metadata: z.record(z.any())
});

// Request/Response type definitions for specific endpoints
export interface AuthRequest {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface WorkspaceRequest {
  name: string;
  settings: Record<string, any>;
}

export interface ProjectRequest {
  name: string;
  workspaceId: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface DiagramRequest {
  name: string;
  projectId: string;
  sqlDDL?: string;
}

// API endpoint response types
export type WorkspacesResponse = PaginatedResponse<Workspace>;
export type ProjectsResponse = PaginatedResponse<Project>;
export type DiagramsResponse = PaginatedResponse<DiagramData>;

// API error codes
export enum APIErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED'
}

// API rate limiting configuration
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

export const defaultRateLimitConfig: RateLimitConfig = {
  windowMs: 60000, // 1 minute
  maxRequests: 100,
  message: 'Too many requests, please try again later'
};