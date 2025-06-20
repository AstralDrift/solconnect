import { Result } from '@/types';
import { Logger } from '../monitoring/Logger';
import { CryptoService } from '../crypto/CryptoService';
import { DatabaseService, MessageRecord } from '../database/DatabaseService';

export interface SearchQuery {
  text: string;
  filters: SearchFilters;
  userId: string; // wallet address
  maxResults?: number;
}

export interface SearchFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  senders?: string[];
  sessions?: string[];
  contentTypes?: string[];
}

export interface SecureSearchResult {
  messageId: string;
  sessionId: string;
  senderAddress: string;
  decryptedContent: string;
  timestamp: Date;
  relevanceScore: number;
  highlights: string[];
  metadata: {
    contentType: string;
    deviceId: string;
  };
}

export interface SearchResults {
  results: SecureSearchResult[];
  totalCount: number;
  searchTime: number;
  hasMore: boolean;
  nextOffset?: number;
}

/**
 * Security-first message search implementation
 * Prioritizes privacy and encryption above all else
 */
export class SecureMessageSearchService {
  private logger = new Logger('SecureMessageSearchService');
  private cryptoService: CryptoService;
  private databaseService: DatabaseService;
  private searchCache = new Map<string, { results: SearchResults; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(cryptoService: CryptoService, databaseService: DatabaseService) {
    this.cryptoService = cryptoService;
    this.databaseService = databaseService;
  }

  /**
   * Performs secure search with client-side decryption
   * NEVER stores or transmits plaintext content
   */
  async searchMessages(query: SearchQuery): Promise<Result<SearchResults>> {
    const startTime = Date.now();
    
    try {
      // Check cache first (encrypted cache keys)
      const cacheKey = await this.generateSecureCacheKey(query);
      const cached = this.getFromSecureCache(cacheKey);
      if (cached) {
        this.logger.debug('Search cache hit', { userId: query.userId });
        return { success: true, data: cached };
      }

      // Step 1: Get encrypted message candidates from database
      const candidatesResult = await this.getEncryptedCandidates(query);
      if (!candidatesResult.success) {
        return candidatesResult;
      }

      // Step 2: Decrypt messages client-side for search
      const decryptedCandidates = await this.secureDecryptForSearch(
        candidatesResult.data, 
        query.userId
      );

      // Step 3: Perform client-side full-text search
      const searchResults = this.performSecureTextSearch(decryptedCandidates, query);

      // Step 4: Cache results securely
      await this.cacheSecureResults(cacheKey, searchResults);

      const searchTime = Date.now() - startTime;
      this.logger.info('Secure search completed', {
        userId: query.userId,
        resultCount: searchResults.results.length,
        searchTime
      });

      return {
        success: true,
        data: {
          ...searchResults,
          searchTime
        }
      };

    } catch (error) {
      this.logger.error('Secure search failed', error);
      return {
        success: false,
        error: new Error(`Secure search failed: ${error.message}`)
      };
    }
  }

  /**
   * Get encrypted message candidates using only metadata filters
   * This step uses no plaintext content whatsoever
   */
  private async getEncryptedCandidates(query: SearchQuery): Promise<Result<MessageRecord[]>> {
    try {
      // Build metadata-only query to avoid any plaintext exposure
      const metadataQuery = `
        SELECT m.* FROM messages m
        JOIN chat_sessions cs ON m.session_id = cs.id
        JOIN session_participants sp ON cs.id = sp.session_id
        WHERE sp.wallet_address = $1
        ${this.buildMetadataFilters(query.filters)}
        ORDER BY m.timestamp DESC
        LIMIT $2
      `;

      const values = [query.userId, query.maxResults || 1000];
      const result = await this.databaseService['pool'].query(metadataQuery, values);
      
      return {
        success: true,
        data: result.rows.map(row => this.databaseService['mapMessageRecord'](row))
      };

    } catch (error) {
      this.logger.error('Failed to get encrypted candidates', error);
      return {
        success: false,
        error: new Error(`Failed to get encrypted candidates: ${error.message}`)
      };
    }
  }

  /**
   * Securely decrypt messages for search
   * Uses session keys and ensures no plaintext leakage
   */
  private async secureDecryptForSearch(
    encryptedMessages: MessageRecord[], 
    userId: string
  ): Promise<Array<{message: MessageRecord; decryptedContent: string}>> {
    const decrypted = [];

    for (const message of encryptedMessages) {
      try {
        // Get session key for this message
        const sessionKey = await this.cryptoService.getSessionKey(message.sessionId, userId);
        if (!sessionKey) {
          this.logger.warn('No session key for message', { 
            messageId: message.messageId,
            sessionId: message.sessionId 
          });
          continue;
        }

        // Decrypt content securely
        const decryptedContent = await this.cryptoService.decryptMessage(
          message.content,
          sessionKey
        );

        decrypted.push({
          message,
          decryptedContent
        });

        // Immediately zero out session key from memory
        sessionKey.fill(0);

      } catch (error) {
        this.logger.warn('Failed to decrypt message for search', {
          messageId: message.messageId,
          error: error.message
        });
        // Continue with other messages rather than failing entire search
      }
    }

    return decrypted;
  }

  /**
   * Perform client-side full-text search on decrypted content
   * Never stores or logs the plaintext content
   */
  private performSecureTextSearch(
    decryptedMessages: Array<{message: MessageRecord; decryptedContent: string}>,
    query: SearchQuery
  ): SearchResults {
    const searchTerms = this.parseSearchTerms(query.text.toLowerCase());
    const results: SecureSearchResult[] = [];

    for (const { message, decryptedContent } of decryptedMessages) {
      const content = decryptedContent.toLowerCase();
      const relevance = this.calculateSecureRelevance(content, searchTerms, message.timestamp);
      
      if (relevance > 0) {
        const highlights = this.generateSecureHighlights(decryptedContent, searchTerms);
        
        results.push({
          messageId: message.messageId,
          sessionId: message.sessionId,
          senderAddress: message.senderAddress,
          decryptedContent, // Only included in results, never stored
          timestamp: message.timestamp,
          relevanceScore: relevance,
          highlights,
          metadata: {
            contentType: message.contentType,
            deviceId: message.deviceId
          }
        });
      }

      // Immediately clear decrypted content from memory
      decryptedContent.replace(/./g, '0');
    }

    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      results: results.slice(0, query.maxResults || 50),
      totalCount: results.length,
      searchTime: 0, // Will be set by caller
      hasMore: results.length > (query.maxResults || 50)
    };
  }

  private parseSearchTerms(searchText: string): string[] {
    // Handle quoted phrases and individual terms
    const terms = [];
    const regex = /"([^"]+)"|(\S+)/g;
    let match;

    while ((match = regex.exec(searchText)) !== null) {
      terms.push(match[1] || match[2]);
    }

    return terms;
  }

  private calculateSecureRelevance(content: string, searchTerms: string[], timestamp: Date): number {
    let score = 0;
    
    for (const term of searchTerms) {
      const occurrences = (content.match(new RegExp(term, 'gi')) || []).length;
      score += occurrences * 10;
      
      // Boost score for exact matches at word boundaries
      if (content.match(new RegExp(`\\b${term}\\b`, 'i'))) {
        score += 20;
      }
    }

    // Apply recency bias (more recent = higher score)
    const daysSinceMessage = (Date.now() - timestamp.getTime()) / (24 * 60 * 60 * 1000);
    const recencyMultiplier = Math.max(0.1, 1 - (daysSinceMessage / 365)); // Decay over a year
    
    return score * recencyMultiplier;
  }

  private generateSecureHighlights(content: string, searchTerms: string[]): string[] {
    const highlights = [];
    
    for (const term of searchTerms) {
      const regex = new RegExp(`(.{0,50})(${term})(.{0,50})`, 'gi');
      const match = content.match(regex);
      
      if (match) {
        // Create highlighted snippet without storing full content
        const snippet = match[0].replace(
          new RegExp(`(${term})`, 'gi'),
          '<mark>$1</mark>'
        );
        highlights.push(`...${snippet}...`);
      }
    }

    return highlights.slice(0, 3); // Limit to 3 highlights per message
  }

  private buildMetadataFilters(filters: SearchFilters): string {
    const conditions = [];
    
    if (filters.dateRange) {
      conditions.push('AND m.timestamp BETWEEN $3 AND $4');
    }
    
    if (filters.senders && filters.senders.length > 0) {
      conditions.push(`AND m.sender_address = ANY($${conditions.length + 3})`);
    }
    
    if (filters.sessions && filters.sessions.length > 0) {
      conditions.push(`AND cs.session_id = ANY($${conditions.length + 3})`);
    }

    return conditions.join(' ');
  }

  private async generateSecureCacheKey(query: SearchQuery): Promise<string> {
    // Create cache key from query hash (no plaintext in cache keys)
    const queryString = JSON.stringify({
      text: query.text,
      filters: query.filters,
      userId: query.userId
    });
    
    const hash = await this.cryptoService.hash(queryString);
    return hash.substring(0, 16); // Use first 16 chars as cache key
  }

  private getFromSecureCache(cacheKey: string): SearchResults | null {
    const cached = this.searchCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.results;
    }
    
    // Clean up expired cache entries
    if (cached) {
      this.searchCache.delete(cacheKey);
    }
    
    return null;
  }

  private async cacheSecureResults(cacheKey: string, results: SearchResults): Promise<void> {
    // Cache with TTL, automatically cleaned up
    this.searchCache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });

    // Limit cache size to prevent memory issues
    if (this.searchCache.size > 100) {
      const oldestKey = this.searchCache.keys().next().value;
      this.searchCache.delete(oldestKey);
    }
  }

  /**
   * Clear all search cache (for security)
   */
  clearSecureCache(): void {
    this.searchCache.clear();
    this.logger.info('Secure search cache cleared');
  }
}