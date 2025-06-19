/**
 * Jest configuration for SolConnect
 * Configures testing environment for React, TypeScript, and Node.js components
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setupTests.ts'],
  
  // Module paths and aliases
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^~/(.*)$': '<rootDir>/$1',
  },
  
  // Test patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/test-utils/**',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/pages/_app.tsx',
    '!src/pages/_document.tsx',
  ],
  
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  coverageDirectory: 'coverage',
  
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Test timeout
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Global setup/teardown
  globalSetup: '<rootDir>/src/test-utils/globalSetup.ts',
  globalTeardown: '<rootDir>/src/test-utils/globalTeardown.ts',
  
  // Mock configuration
  moduleNameMapping: {
    // Mock CSS modules
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // Mock static assets
    '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': '<rootDir>/src/test-utils/__mocks__/fileMock.js',
    
    // Module aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    '^~/(.*)$': '<rootDir>/$1',
  },
  
  // Environment variables for tests
  setupFiles: ['<rootDir>/src/test-utils/envSetup.ts'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/build/',
    '<rootDir>/dist/',
  ],
  
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
  
  // Error handling
  errorOnDeprecated: true,
  
  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,
  
  // Snapshot serializers
  snapshotSerializers: [
    'enzyme-to-json/serializer'
  ],
  
  // Custom matchers
  setupFilesAfterEnv: [
    '<rootDir>/src/test-utils/setupTests.ts',
    '<rootDir>/src/test-utils/customMatchers.ts'
  ]
};

// Create Jest config with Next.js optimizations
module.exports = createJestConfig(customJestConfig);