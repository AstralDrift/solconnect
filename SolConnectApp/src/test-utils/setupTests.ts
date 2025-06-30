/**
 * Jest setup file for SolConnect tests
 * Configures testing environment, mocks, and utilities
 */

import '@testing-library/jest-dom';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SOLANA_RPC_URL = 'https://api.devnet.solana.com';
process.env.NEXT_PUBLIC_RELAY_URL = 'ws://localhost:8080';

// Mock WebSocket globally
global.WebSocket = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock crypto.getRandomValues for tests
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn().mockImplementation((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    subtle: {
      generateKey: jest.fn().mockImplementation((algorithm: any, extractable: boolean, keyUsages: string[]) => {
        // Mock crypto key pair for testing
        return Promise.resolve({
          publicKey: {
            type: 'public',
            extractable: true,
            algorithm,
            usages: keyUsages.filter(u => u === 'verify'),
            _mock: true
          },
          privateKey: {
            type: 'private', 
            extractable: true,
            algorithm,
            usages: keyUsages.filter(u => u === 'sign'),
            _mock: true
          }
        });
      }),
      importKey: jest.fn().mockImplementation((format: string, keyData: any, algorithm: any, extractable: boolean, keyUsages: string[]) => {
        return Promise.resolve({
          type: keyUsages.includes('sign') ? 'private' : 'public',
          extractable,
          algorithm,
          usages: keyUsages,
          _mock: true
        });
      }),
      exportKey: jest.fn().mockImplementation((format: string, key: any) => {
        return Promise.resolve(new ArrayBuffer(32));
      }),
      encrypt: jest.fn().mockImplementation((algorithm: any, key: any, data: ArrayBuffer) => {
        // Mock AES-GCM encryption - return data + 16 byte tag
        const input = new Uint8Array(data);
        const output = new Uint8Array(input.length + 16);
        output.set(input, 0);
        // Fill tag with mock data
        for (let i = input.length; i < output.length; i++) {
          output[i] = Math.floor(Math.random() * 256);
        }
        return Promise.resolve(output.buffer);
      }),
      decrypt: jest.fn().mockImplementation((algorithm: any, key: any, data: ArrayBuffer) => {
        // Mock AES-GCM decryption - remove 16 byte tag
        const input = new Uint8Array(data);
        const output = input.slice(0, -16);
        return Promise.resolve(output.buffer);
      }),
      sign: jest.fn().mockImplementation((algorithm: any, key: any, data: ArrayBuffer) => {
        // Mock signing - return 64 byte signature
        const signature = new Uint8Array(64);
        for (let i = 0; i < signature.length; i++) {
          signature[i] = Math.floor(Math.random() * 256);
        }
        return Promise.resolve(signature.buffer);
      }),
      verify: jest.fn().mockImplementation((algorithm: any, key: any, signature: ArrayBuffer, data: ArrayBuffer) => {
        // Mock verification - always return true for tests
        return Promise.resolve(true);
      }),
      deriveBits: jest.fn().mockImplementation((algorithm: any, baseKey: any, length: number) => {
        // Mock key derivation - make deterministic for tests
        const bits = new Uint8Array(length / 8);
        // Use a simple deterministic pattern based on the algorithm and length
        const seed = algorithm.info ? algorithm.info.reduce((acc: number, byte: number) => acc + byte, 0) : 42;
        for (let i = 0; i < bits.length; i++) {
          bits[i] = (seed + i) % 256;
        }
        return Promise.resolve(bits.buffer);
      }),
      deriveKey: jest.fn().mockImplementation((algorithm: any, baseKey: any, derivedKeyType: any, extractable: boolean, keyUsages: string[]) => {
        return Promise.resolve({
          type: 'secret',
          extractable,
          algorithm: derivedKeyType,
          usages: keyUsages,
          _mock: true
        });
      })
    }
  }
});

// Mock btoa/atob for base64 operations
global.btoa = jest.fn().mockImplementation((str: string) => Buffer.from(str, 'binary').toString('base64'));
global.atob = jest.fn().mockImplementation((str: string) => Buffer.from(str, 'base64').toString('binary'));

// Mock TextEncoder/TextDecoder
global.TextEncoder = jest.fn().mockImplementation(() => ({
  encode: jest.fn().mockImplementation((str: string) => new Uint8Array(Buffer.from(str, 'utf8')))
}));

global.TextDecoder = jest.fn().mockImplementation(() => ({
  decode: jest.fn().mockImplementation((buffer: Uint8Array) => Buffer.from(buffer).toString('utf8'))
}));

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Suppress console.error and console.warn unless explicitly testing them
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia (only if window exists)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      hostname: 'localhost',
      port: '3000',
      protocol: 'http:',
      pathname: '/',
      search: '',
      hash: '',
      reload: jest.fn(),
      assign: jest.fn(),
      replace: jest.fn(),
    },
    writable: true,
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock
  });
}

// Enhanced cleanup after each test
afterEach(() => {
  // Clear localStorage (only if available)
  if (typeof window !== 'undefined' && window.localStorage) {
    const localStorageMock = window.localStorage as any;
    localStorageMock.getItem?.mockClear();
    localStorageMock.setItem?.mockClear();
    localStorageMock.removeItem?.mockClear();
    localStorageMock.clear?.mockClear();
  }
  
  // Clear any timers
  jest.clearAllTimers();
  
  // Clear any pending promises
});

// Global test utilities
export const mockWalletAddress = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

export const createMockMessage = (overrides = {}) => ({
  sender_wallet: mockWalletAddress,
  ciphertext: 'Test message',
  timestamp: new Date().toISOString(),
  session_id: 'test-session',
  ...overrides
});

export const createMockSession = (overrides = {}) => ({
  session_id: 'test-session-123',
  peer_wallet: mockWalletAddress,
  sharedKey: new Uint8Array(32),
  ...overrides
});

export const createMockWallet = (overrides = {}) => ({
  address: mockWalletAddress,
  connected: true,
  balance: 1.5,
  ...overrides
});

// Async testing utilities
export const waitForNextTick = () => new Promise(resolve => setImmediate(resolve));

export const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// Mock error for testing
export const createMockError = (code = 'UNKNOWN_ERROR', message = 'Test error') => ({
  code,
  message,
  userMessage: message,
  category: 'system',
  recoverable: true,
  timestamp: Date.now()
});