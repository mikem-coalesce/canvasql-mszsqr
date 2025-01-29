import { rest } from 'msw';
import { HttpResponse, delay } from 'msw';
import type { AuthUser, AuthTokens, MFAVerification } from '../../src/types/auth.types';
import type { APIResponse, ErrorResponse } from '../../src/types/api.types';

// API Base URL
const BASE_URL = '/api/v1';

// Mock user data
const MOCK_USER: AuthUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'ADMIN',
  mfaEnabled: true,
  mfaType: 'TOTP',
  lastLogin: new Date(),
  failedAttempts: 0,
  createdAt: new Date(),
  updatedAt: new Date()
};

// Mock tokens
const MOCK_TOKENS: AuthTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  tokenType: 'Bearer'
};

// Mock error responses
const MOCK_ERRORS = {
  UNAUTHORIZED: { code: 401, message: 'Unauthorized access' },
  FORBIDDEN: { code: 403, message: 'Forbidden action' },
  NOT_FOUND: { code: 404, message: 'Resource not found' },
  RATE_LIMIT: { code: 429, message: 'Too many requests' }
};

// Authentication handlers
const authHandlers = [
  // Login endpoint
  rest.post(`${BASE_URL}/auth/login`, async (req, res, ctx) => {
    await delay(100); // Simulate network latency
    
    const { email, password, mfaCode } = await req.json();
    
    if (!email || !password) {
      return HttpResponse.json<APIResponse<null>>({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid credentials' }
      }, { status: 400 });
    }

    if (MOCK_USER.mfaEnabled && !mfaCode) {
      return HttpResponse.json<APIResponse<MFAVerification>>({
        success: false,
        data: { required: true, type: MOCK_USER.mfaType },
        error: { code: 'MFA_REQUIRED', message: 'MFA verification required' }
      }, { status: 403 });
    }

    return HttpResponse.json<APIResponse<{ user: AuthUser; tokens: AuthTokens }>>({
      success: true,
      data: { user: MOCK_USER, tokens: MOCK_TOKENS },
      error: null
    });
  }),

  // Logout endpoint
  rest.post(`${BASE_URL}/auth/logout`, async (req, res, ctx) => {
    await delay(50);
    return HttpResponse.json<APIResponse<null>>({
      success: true,
      data: null,
      error: null
    });
  }),

  // Get current user endpoint
  rest.get(`${BASE_URL}/auth/me`, async (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json<APIResponse<null>>({
        success: false,
        data: null,
        error: MOCK_ERRORS.UNAUTHORIZED
      }, { status: 401 });
    }

    return HttpResponse.json<APIResponse<AuthUser>>({
      success: true,
      data: MOCK_USER,
      error: null
    });
  }),

  // Refresh token endpoint
  rest.post(`${BASE_URL}/auth/refresh`, async (req, res, ctx) => {
    const { refreshToken } = await req.json();
    
    if (!refreshToken) {
      return HttpResponse.json<APIResponse<null>>({
        success: false,
        data: null,
        error: MOCK_ERRORS.UNAUTHORIZED
      }, { status: 401 });
    }

    return HttpResponse.json<APIResponse<AuthTokens>>({
      success: true,
      data: MOCK_TOKENS,
      error: null
    });
  })
];

// Workspace handlers
const workspaceHandlers = [
  // Get workspaces endpoint
  rest.get(`${BASE_URL}/workspaces`, async (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return HttpResponse.json<APIResponse<null>>({
        success: false,
        data: null,
        error: MOCK_ERRORS.UNAUTHORIZED
      }, { status: 401 });
    }

    return HttpResponse.json<APIResponse<any>>({
      success: true,
      data: {
        items: [
          {
            id: 'workspace-1',
            name: 'Test Workspace',
            ownerId: MOCK_USER.id,
            settings: {
              defaultRole: 'EDITOR',
              allowPublicSharing: false,
              enableVersionHistory: true,
              requireMfa: true
            },
            createdAt: new Date().toISOString()
          }
        ],
        total: 1,
        page: 1,
        pageSize: 10
      },
      error: null
    });
  })
];

// Project handlers
const projectHandlers = [
  // Get projects endpoint
  rest.get(`${BASE_URL}/projects`, async (req, res, ctx) => {
    const workspaceId = req.url.searchParams.get('workspaceId');
    
    if (!workspaceId) {
      return HttpResponse.json<APIResponse<null>>({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Workspace ID required' }
      }, { status: 400 });
    }

    return HttpResponse.json<APIResponse<any>>({
      success: true,
      data: {
        items: [
          {
            id: 'project-1',
            workspaceId,
            name: 'Test Project',
            description: 'Test project description',
            metadata: {
              sqlDialect: 'POSTGRESQL',
              defaultLayout: 'DEFAULT',
              tags: ['test'],
              versionHistory: true,
              auditEnabled: true
            },
            createdAt: new Date().toISOString()
          }
        ],
        total: 1,
        page: 1,
        pageSize: 10
      },
      error: null
    });
  })
];

// Diagram handlers
const diagramHandlers = [
  // Get diagrams endpoint
  rest.get(`${BASE_URL}/diagrams`, async (req, res, ctx) => {
    const projectId = req.url.searchParams.get('projectId');
    
    if (!projectId) {
      return HttpResponse.json<APIResponse<null>>({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Project ID required' }
      }, { status: 400 });
    }

    return HttpResponse.json<APIResponse<any>>({
      success: true,
      data: {
        items: [
          {
            id: 'diagram-1',
            projectId,
            name: 'Test Diagram',
            sqlDDL: 'CREATE TABLE test (id INT PRIMARY KEY);',
            layout: {
              nodes: [],
              edges: [],
              viewport: { x: 0, y: 0, zoom: 1 }
            },
            version: 1,
            lastModified: new Date().toISOString()
          }
        ],
        total: 1,
        page: 1,
        pageSize: 10
      },
      error: null
    });
  })
];

// Export all handlers
export const handlers = [
  ...authHandlers,
  ...workspaceHandlers,
  ...projectHandlers,
  ...diagramHandlers
];