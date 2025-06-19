// Custom Jest matchers for SolConnect tests
expect.extend({
  toBeValidResult(received: any) {
    const pass = 
      received !== null &&
      typeof received === 'object' &&
      'success' in received &&
      typeof received.success === 'boolean' &&
      (received.success ? 'data' in received : 'error' in received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Result type`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Result type with success boolean and data/error property`,
        pass: false,
      };
    }
  },
}); 