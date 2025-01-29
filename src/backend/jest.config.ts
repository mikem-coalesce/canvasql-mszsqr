import type { Config } from '@jest/types';

/*
 * Jest Configuration for Backend Service
 * Version: Jest 29.x
 * Environment: Node.js
 * Coverage Requirements: 80% across all metrics
 */

const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as test environment
  testEnvironment: 'node',

  // Define test file locations
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],

  // Test file patterns
  testMatch: [
    '**/*.test.ts',
    '**/*.spec.ts'
  ],

  // Path alias mapping for @ imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // TypeScript transformation configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      diagnostics: true
    }]
  },

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Coverage exclusion patterns
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/tests/',
    '/*.d.ts',
    '/src/types/',
    '/src/migrations/'
  ],

  // Test exclusion patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],

  // Test setup file
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],

  // TypeScript compiler options for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      diagnostics: {
        warnOnly: false
      }
    }
  },

  // Test execution configuration
  verbose: true,
  testTimeout: 10000,
  maxWorkers: '50%',
  clearMocks: true,
  restoreMocks: true,
  detectOpenHandles: true,
  forceExit: true,
  bail: 1,
  errorOnDeprecated: true
};

export default config;