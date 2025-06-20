import { Result } from '@/types';
import { Logger } from '../monitoring/Logger';
import { DatabaseService } from '../database/DatabaseService';
import { SecureMessageSearchService, SearchQuery, SearchResults } from './SecureMessageSearchService';
import { CryptoService } from '../crypto/CryptoService';

/**
 * Integration service that bridges SecureMessageSearchService with DatabaseService
 * Handles the flow of indexing, searching, and managing search data
 */
export class MessageSearchIntegrationService {
  private logger = new Logger('MessageSearchIntegrationService');
  private secureSearchService: SecureMessageSearchService;
  private databaseService: DatabaseService;
  private cryptoService: CryptoService;
  private indexingQueue: Map<string, Promise<void>> = new Map();

  constructor(
    cryptoService: CryptoService,
    databaseService: DatabaseService
  ) {
    this.cryptoService = cryptoService;
    this.databaseService = databaseService;
    this.secureSearchService = new SecureMessageSearchService(cryptoService, databaseService);
  }

  /**
   * Main search method that integrates secure search with database
   */
  async searchMessages(query: SearchQuery): Promise<Result<SearchResults>> {
    try {
      // First, try database search for already indexed messages
      const dbSearchResult = await this.searchInDatabase(query);
      
      if (dbSearchResult.success && dbSearchResult.data.results.length > 0) {
        // Enhance database results with decrypted content
        const enhancedResults = await this.enhanceSearchResults(
          dbSearchResult.data.results,
          query.userId
        );
        
        return {
          success: true,
          data: {
            results: enhancedResults,
            totalCount: dbSearchResult.data.totalCount,
            searchTime: dbSearchResult.data.searchTime,
            hasMore: dbSearchResult.data.totalCount > enhancedResults.length
          }
        };
      }

      // Fallback to secure client-side search if database search yields no results
      // This handles cases where messages haven't been indexed yet
      return await this.secureSearchService.searchMessages(query);
      
    } catch (error) {
      this.logger.error('Search integration failed', error);
      return {
        success: false,
        error: new Error(`Search integration failed: ${error.message}`)
      };
    }
  }

  /**
   * Search in database using indexed content
   */
  private async searchInDatabase(query: SearchQuery): Promise<Result<{
    results: Array<{
      messageId: string;
      sessionId: string;
      senderAddress: string;
      timestamp: Date;
      relevanceScore: number;
      headline: string;
    }>;
    totalCount: number;
    searchTime: number;
  }>> {
    const startTime = Date.now();

    const dbResult = await this.databaseService.searchMessages({
      userWallet: query.userId,
      searchQuery: query.text,
      sessionIds: query.filters.sessions,
      senderAddresses: query.filters.senders,
      dateRange: query.filters.dateRange,
      limit: query.maxResults,
      offset: 0
    });

    if (!dbResult.success) {
      return dbResult;
    }

    return {
      success: true,
      data: {
        ...dbResult.data,
        searchTime: Date.now() - startTime
      }
    };
  }

  /**
   * Enhance database search results with decrypted content
   */
  private async enhanceSearchResults(
    dbResults: Array<{
      messageId: string;
      sessionId: string;
      senderAddress: string;
      timestamp: Date;
      relevanceScore: number;
      headline: string;
    }>,
    userId: string
  ): Promise<any[]> {
    const enhanced = [];

    for (const result of dbResults) {
      try {
        // Get the full message record
        const messageResult = await this.databaseService.getMessageById(result.messageId);
        if (!messageResult.success || !messageResult.data) {
          continue;
        }

        const message = messageResult.data;
        
        // Get session key for decryption
        const sessionKey = await this.cryptoService.getSessionKey(message.sessionId, userId);
        if (!sessionKey) {
          this.logger.warn('No session key for message', { 
            messageId: message.messageId,
            sessionId: message.sessionId 
          });
          continue;
        }

        // Decrypt content
        const decryptedContent = await this.cryptoService.decryptMessage(
          message.content,
          sessionKey
        );

        enhanced.push({
          messageId: result.messageId,
          sessionId: result.sessionId,
          senderAddress: result.senderAddress,
          decryptedContent,
          timestamp: result.timestamp,
          relevanceScore: result.relevanceScore,
          highlights: [result.headline], // Use database-generated headline
          metadata: {
            contentType: message.contentType,
            deviceId: message.deviceId
          }
        });

        // Clear sensitive data
        sessionKey.fill(0);

      } catch (error) {
        this.logger.warn('Failed to enhance search result', {
          messageId: result.messageId,
          error: error.message
        });
      }
    }

    return enhanced;
  }

  /**
   * Index a message for search (called when new messages arrive)
   */
  async indexMessage(messageId: string, sessionId: string, userId: string): Promise<Result<void>> {
    try {
      // Prevent duplicate indexing operations
      if (this.indexingQueue.has(messageId)) {
        await this.indexingQueue.get(messageId);
        return { success: true, data: undefined };
      }

      const indexPromise = this.performIndexing(messageId, sessionId, userId);
      this.indexingQueue.set(messageId, indexPromise);

      await indexPromise;
      this.indexingQueue.delete(messageId);

      return { success: true, data: undefined };
    } catch (error) {
      this.indexingQueue.delete(messageId);
      this.logger.error('Failed to index message', error);
      return {
        success: false,
        error: new Error(`Failed to index message: ${error.message}`)
      };
    }
  }

  private async performIndexing(messageId: string, sessionId: string, userId: string): Promise<void> {
    // Get the message
    const messageResult = await this.databaseService.getMessageById(messageId);
    if (!messageResult.success || !messageResult.data) {
      throw new Error('Message not found');
    }

    const message = messageResult.data;

    // Get session key
    const sessionKey = await this.cryptoService.getSessionKey(sessionId, userId);
    if (!sessionKey) {
      throw new Error('No session key available');
    }

    try {
      // Decrypt content
      const decryptedContent = await this.cryptoService.decryptMessage(
        message.content,
        sessionKey
      );

      // Index in database (with TTL)
      await this.databaseService.indexMessageForSearch(
        messageId,
        decryptedContent,
        24 // 24 hour TTL
      );

      // Clear decrypted content
      decryptedContent.replace(/./g, '0');
    } finally {
      // Always clear session key
      sessionKey.fill(0);
    }
  }

  /**
   * Batch index messages for a session
   */
  async indexSessionMessages(sessionId: string, userId: string, limit: number = 100): Promise<Result<number>> {
    try {
      const messagesResult = await this.databaseService.getSessionMessages(sessionId, limit);
      if (!messagesResult.success) {
        return {
          success: false,
          error: messagesResult.error
        };
      }

      let indexedCount = 0;
      const messages = messagesResult.data;

      // Index in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (message) => {
            const result = await this.indexMessage(message.messageId, message.sessionId, userId);
            if (result.success) {
              indexedCount++;
            }
          })
        );
      }

      this.logger.info('Batch indexing completed', {
        sessionId,
        totalMessages: messages.length,
        indexedCount
      });

      return {
        success: true,
        data: indexedCount
      };
    } catch (error) {
      this.logger.error('Batch indexing failed', error);
      return {
        success: false,
        error: new Error(`Batch indexing failed: ${error.message}`)
      };
    }
  }

  /**
   * Remove a message from search index
   */
  async removeFromIndex(messageId: string): Promise<Result<void>> {
    return await this.databaseService.removeFromSearchIndex(messageId);
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSearchSuggestions(userId: string, partialQuery: string): Promise<Result<string[]>> {
    if (partialQuery.length < 2) {
      return { success: true, data: [] };
    }

    return await this.databaseService.getSearchSuggestions(userId, partialQuery);
  }

  /**
   * Get search history for a user
   */
  async getSearchHistory(userId: string, limit: number = 20): Promise<Result<any[]>> {
    return await this.databaseService.getSearchHistory(userId, limit);
  }

  /**
   * Clear search history for a user
   */
  async clearSearchHistory(userId: string): Promise<Result<void>> {
    return await this.databaseService.clearSearchHistory(userId);
  }

  /**
   * Clean up expired search index entries
   */
  async cleanupExpiredContent(): Promise<Result<number>> {
    return await this.databaseService.cleanupExpiredSearchContent();
  }
}

// Extension to DatabaseService to add missing method
declare module '../database/DatabaseService' {
  interface DatabaseService {
    getMessageById(messageId: string): Promise<Result<MessageRecord | null>>;
  }
} 