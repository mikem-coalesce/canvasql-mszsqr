/**
 * @fileoverview MSW server configuration for API request mocking in tests
 * @version 1.0.0
 */

import { setupServer } from 'msw/node'; // v1.3.0
import { handlers } from './handlers';

/**
 * Configure MSW server with all API endpoint handlers
 * Implements comprehensive API mocking for:
 * - Authentication endpoints
 * - Workspace operations
 * - Project management
 * - Diagram handling
 */
const server = setupServer(...handlers);

// Ensure clean server state between tests
beforeAll(() => {
  // Establish request interception
  server.listen({
    onUnhandledRequest: 'error' // Strict mode - fail on unhandled requests
  });
});

afterEach(() => {
  // Reset handlers between tests
  server.resetHandlers();
});

afterAll(() => {
  // Clean up after all tests complete
  server.close();
});

export { server };