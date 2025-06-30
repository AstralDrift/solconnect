import { describe, it, expect } from 'vitest';
import { isSearchQuery, isSearchResult, SearchResult } from '../search';

describe('Search type guards', () => {
  it('isSearchQuery should identify valid query', () => {
    const q = { text: 'hello', limit: 10 };
    expect(isSearchQuery(q)).toBe(true);
  });

  it('isSearchQuery should reject invalid object', () => {
    const q = { wrong: true };
    expect(isSearchQuery(q)).toBe(false);
  });

  it('isSearchResult should identify valid result', () => {
    const r: SearchResult = {
      messageId: '1',
      sessionId: 's',
      score: 0.9,
      timestamp: new Date().toISOString(),
      sender: 'alice.sol'
    };
    expect(isSearchResult(r)).toBe(true);
  });

  it('isSearchResult should reject invalid result', () => {
    const r = { sessionId: 's', score: 0.5 };
    expect(isSearchResult(r)).toBe(false);
  });
}); 