// Types for encrypted message search functionality
// =================================================
// These interfaces are used across the search index service, SDK API, and UI.

export enum SearchFilter {
  DateRange = 'date',
  Sender = 'sender',
  Type = 'type',
  Media = 'media'
}

export interface DateRangeFilter {
  from?: string; // ISO timestamp (inclusive)
  to?: string;   // ISO timestamp (inclusive)
}

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'audio' | 'sticker';

export interface SearchQueryFilters {
  dateRange?: DateRangeFilter;
  sender?: string;           // wallet address / peer id
  messageType?: MessageType; // filter by message content type
  hasMedia?: boolean;        // quick filter for messages with media
}

/**
 * SearchQuery – passed from UI → SDK → SearchIndexService.
 * All string fields MUST be encrypted before hitting storage layer.
 */
export interface SearchQuery {
  text: string;                       // raw user query (will be encrypted deterministically)
  filters?: SearchQueryFilters;       // additional filter criteria
  limit?: number;                     // pagination limit
  offset?: number;                    // pagination offset
  includeHighlights?: boolean;        // whether to return highlight snippets
}

/**
 * Encrypted index entry metadata used internally.
 */
export interface SearchIndexEntry {
  messageId: string;
  sessionId: string;
  encryptedTerms: string[];  // encrypted tokens for matching
  createdAt: number;         // epoch milliseconds
}

export interface SearchResultHighlight {
  snippet: string; // encrypted snippet – decrypted on client before display
  term: string;    // searched term that matched (plain after decrypt)
}

/**
 * Result returned to UI after decrypting.
 */
export interface SearchResult {
  messageId: string;
  sessionId: string;
  score: number;                        // relevance score 0..1
  highlights?: SearchResultHighlight[]; // optional highlight snippets
  timestamp: string;                    // ISO timestamp of message
  sender: string;                       // wallet address
}

/**
 * SearchIndex interface abstracts index implementation (web-worker backed).
 */
export interface SearchIndex {
  build(messages: any[]): Promise<void>;           // full rebuild
  update(message: any): Promise<void>;             // incremental update
  query(q: SearchQuery): Promise<SearchResult[]>;  // encrypted query
  optimize(): Promise<void>;                       // cleanup/compact index
}

// Utility type guards (runtime)
export function isSearchQuery(obj: any): obj is SearchQuery {
  return obj && typeof obj.text === 'string';
}

export function isSearchResult(obj: any): obj is SearchResult {
  return obj && typeof obj.messageId === 'string' && typeof obj.score === 'number';
} 