/**
 * @fileoverview Global test setup configuration for frontend application
 * @version 1.0.0
 */

import '@testing-library/jest-dom/vitest'; // v6.1.0
import { vi } from 'vitest'; // v0.34.0
import { server } from './mocks/server';

/**
 * Configure global test environment for Vitest
 * Implements test environment setup with proper API mocking
 */

// Configure MSW server for API request interception
beforeAll(() => {
  // Start MSW server in strict mode - will error on unhandled requests
  server.listen({
    onUnhandledRequest: 'error'
  });
});

// Reset request handlers between tests for clean state
afterEach(() => {
  server.resetHandlers();
});

// Clean up MSW server after all tests complete
afterAll(() => {
  server.close();
});

// Configure global test environment
vi.mock('zustand', () => ({
  create: vi.fn((createState) => createState),
}));

// Mock ResizeObserver for React Flow components
const ResizeObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Add ResizeObserver to global scope
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// Mock IntersectionObserver for infinite scroll and visibility detection
const IntersectionObserverMock = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Add IntersectionObserver to global scope
vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

// Configure timezone for consistent date testing
vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

// Configure random seed for consistent test runs
vi.spyOn(Math, 'random').mockImplementation(() => 0.5);

// Configure fetch mock responses
vi.stubGlobal('fetch', vi.fn());

// Configure local storage mock
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

vi.stubGlobal('localStorage', localStorageMock);

// Configure session storage mock
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

vi.stubGlobal('sessionStorage', sessionStorageMock);

// Configure clipboard API mock
const clipboardMock = {
  writeText: vi.fn(),
  readText: vi.fn(),
};

vi.stubGlobal('navigator', {
  clipboard: clipboardMock,
});

// Configure WebSocket mock
class WebSocketMock {
  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  
  send = vi.fn();
  close = vi.fn();
}

vi.stubGlobal('WebSocket', WebSocketMock);

// Configure window.matchMedia mock
vi.stubGlobal('matchMedia', vi.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})));

// Configure error boundary handling
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    /Warning.*not wrapped in act/.test(args[0]) ||
    /Warning.*Cannot update a component/.test(args[0])
  ) {
    return;
  }
  originalConsoleError(...args);
};