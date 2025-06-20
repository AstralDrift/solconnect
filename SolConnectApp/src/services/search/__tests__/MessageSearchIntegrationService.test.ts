import { MessageSearchIntegrationService } from '../MessageSearchIntegrationService';
import { DatabaseService } from '../../database/DatabaseService';
import { CryptoService } from '../../crypto/CryptoService';

// Mock dependencies
jest.mock('../../database/DatabaseService');
jest.mock('../../crypto/CryptoService');

describe('MessageSearchIntegrationService', () => {
  let searchService: MessageSearchIntegrationService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockCryptoService: jest.Mocked<CryptoService>;

  beforeEach(() => {
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;
    mockCryptoService = {} as jest.Mocked<CryptoService>;
    
    searchService = new MessageSearchIntegrationService(
      mockCryptoService,
      mockDatabaseService
    );
  });

  describe('searchMessages', () => {
    it('should search messages using database when indexed content exists', async () => {
      // Mock database search results
      mockDatabaseService.searchMessages.mockResolvedValue({
        success: true,
        data: {
          results: [
            {
              messageId: 'msg-123',
              sessionId: 'session-456',
              senderAddress: 'wallet123',
              timestamp: new Date(),
              relevanceScore: 0.95,
              headline: 'Hello <mark>world</mark>'
            }
          ],
          totalCount: 1
        }
      });

      mockDatabaseService.getMessageById.mockResolvedValue({
        success: true,
        data: {
          id: '123',
          messageId: 'msg-123',
          sessionId: 'session-456',
          senderAddress: 'wallet123',
          content: 'encrypted-content',
          contentType: 'text',
          deviceId: 'device-1',
          sequenceNumber: 1,
          signature: 'sig',
          timestamp: new Date(),
          serverTimestamp: new Date(),
          syncStatus: 'synced'
        }
      });

      mockCryptoService.getSessionKey = jest.fn().mockResolvedValue(new Uint8Array(32));
      mockCryptoService.decryptMessage = jest.fn().mockResolvedValue('Hello world');

      const result = await searchService.searchMessages({
        text: 'world',
        filters: {},
        userId: 'user-wallet',
        maxResults: 50
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(1);
      expect(result.data?.results[0].decryptedContent).toBe('Hello world');
      expect(mockDatabaseService.searchMessages).toHaveBeenCalledWith({
        userWallet: 'user-wallet',
        searchQuery: 'world',
        sessionIds: undefined,
        senderAddresses: undefined,
        dateRange: undefined,
        limit: 50,
        offset: 0
      });
    });

    it('should handle search errors gracefully', async () => {
      mockDatabaseService.searchMessages.mockResolvedValue({
        success: false,
        error: new Error('Database error')
      });

      const result = await searchService.searchMessages({
        text: 'test',
        filters: {},
        userId: 'user-wallet'
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('indexMessage', () => {
    it('should index a message for search', async () => {
      mockDatabaseService.getMessageById.mockResolvedValue({
        success: true,
        data: {
          id: '123',
          messageId: 'msg-123',
          sessionId: 'session-456',
          senderAddress: 'wallet123',
          content: 'encrypted-content',
          contentType: 'text',
          deviceId: 'device-1',
          sequenceNumber: 1,
          signature: 'sig',
          timestamp: new Date(),
          serverTimestamp: new Date(),
          syncStatus: 'synced'
        }
      });

      mockCryptoService.getSessionKey = jest.fn().mockResolvedValue(new Uint8Array(32));
      mockCryptoService.decryptMessage = jest.fn().mockResolvedValue('Hello world');
      mockDatabaseService.indexMessageForSearch.mockResolvedValue({
        success: true,
        data: undefined
      });

      const result = await searchService.indexMessage('msg-123', 'session-456', 'user-wallet');

      expect(result.success).toBe(true);
      expect(mockDatabaseService.indexMessageForSearch).toHaveBeenCalledWith(
        'msg-123',
        'Hello world',
        24
      );
    });

    it('should handle missing messages gracefully', async () => {
      mockDatabaseService.getMessageById.mockResolvedValue({
        success: true,
        data: null
      });

      const result = await searchService.indexMessage('msg-999', 'session-456', 'user-wallet');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Message not found');
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return empty array for short queries', async () => {
      const result = await searchService.getSearchSuggestions('user-wallet', 'a');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(mockDatabaseService.getSearchSuggestions).not.toHaveBeenCalled();
    });

    it('should get suggestions for valid queries', async () => {
      mockDatabaseService.getSearchSuggestions.mockResolvedValue({
        success: true,
        data: ['hello world', 'hello there']
      });

      const result = await searchService.getSearchSuggestions('user-wallet', 'hello');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['hello world', 'hello there']);
      expect(mockDatabaseService.getSearchSuggestions).toHaveBeenCalledWith(
        'user-wallet',
        'hello'
      );
    });
  });

  describe('cleanupExpiredContent', () => {
    it('should cleanup expired search content', async () => {
      mockDatabaseService.cleanupExpiredSearchContent.mockResolvedValue({
        success: true,
        data: 5
      });

      const result = await searchService.cleanupExpiredContent();

      expect(result.success).toBe(true);
      expect(result.data).toBe(5);
      expect(mockDatabaseService.cleanupExpiredSearchContent).toHaveBeenCalled();
    });
  });
}); 