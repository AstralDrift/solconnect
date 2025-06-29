import { ReactionService } from '../ReactionService';
import { SolConnectError } from '../../types/errors';

// Mock the database service
jest.mock('../database/DatabaseService', () => ({
  getDatabaseService: () => ({
    pool: {
      query: jest.fn()
    }
  })
}));

// Mock the logger
jest.mock('../monitoring/Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('ReactionService', () => {
  let reactionService: ReactionService;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create new service instance
    reactionService = new ReactionService();
    
    // Get mock query function
    const { getDatabaseService } = require('../database/DatabaseService');
    mockQuery = getDatabaseService().pool.query;
  });

  describe('addReaction', () => {
    const validMessageId = 'msg123';
    const validUserAddress = 'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt';
    const validEmoji = '😀';

    it('should successfully add a reaction', async () => {
      // Mock successful database response
      mockQuery.mockResolvedValueOnce({
        rows: [{ success: true, reaction_id: 'reaction123' }]
      });
      
      // Mock get reaction by ID
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'reaction123',
          message_id: validMessageId,
          user_address: validUserAddress,
          emoji: validEmoji,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const result = await reactionService.addReaction(validMessageId, validUserAddress, validEmoji);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.emoji).toBe(validEmoji);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM add_reaction($1, $2, $3)',
        [validMessageId, validUserAddress, validEmoji]
      );
    });

    it('should handle duplicate reaction error', async () => {
      // Mock database response for duplicate reaction
      mockQuery.mockResolvedValueOnce({
        rows: [{ success: false, error_message: 'Reaction already exists' }]
      });

      const result = await reactionService.addReaction(validMessageId, validUserAddress, validEmoji);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SolConnectError);
      expect(result.error?.message).toContain('Reaction already exists');
    });

    it('should validate emoji format', async () => {
      const invalidEmoji = '';

      const result = await reactionService.addReaction(validMessageId, validUserAddress, invalidEmoji);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SolConnectError);
      expect(result.error?.message).toContain('Emoji cannot be empty');
    });

    it('should validate emoji length', async () => {
      const tooLongEmoji = '😀'.repeat(10); // More than 10 characters

      const result = await reactionService.addReaction(validMessageId, validUserAddress, tooLongEmoji);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SolConnectError);
      expect(result.error?.message).toContain('Emoji too long');
    });

    it('should validate wallet address format', async () => {
      const invalidWalletAddress = 'invalid-wallet';

      const result = await reactionService.addReaction(validMessageId, invalidWalletAddress, validEmoji);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SolConnectError);
      expect(result.error?.message).toContain('Invalid wallet address');
    });

    it('should handle database errors', async () => {
      // Mock database error
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await reactionService.addReaction(validMessageId, validUserAddress, validEmoji);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SolConnectError);
      expect(result.error?.message).toContain('Failed to add reaction');
    });
  });

  describe('removeReaction', () => {
    const validMessageId = 'msg123';
    const validUserAddress = 'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt';
    const validEmoji = '😀';

    it('should successfully remove a reaction', async () => {
      // Mock successful database response
      mockQuery.mockResolvedValueOnce({
        rows: [{ success: true, error_message: 'Reaction removed successfully' }]
      });

      const result = await reactionService.removeReaction(validMessageId, validUserAddress, validEmoji);

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM remove_reaction($1, $2, $3)',
        [validMessageId, validUserAddress, validEmoji]
      );
    });

    it('should handle reaction not found error', async () => {
      // Mock database response for reaction not found
      mockQuery.mockResolvedValueOnce({
        rows: [{ success: false, error_message: 'Reaction not found' }]
      });

      const result = await reactionService.removeReaction(validMessageId, validUserAddress, validEmoji);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(SolConnectError);
      expect(result.error?.message).toContain('Reaction not found');
    });
  });

  describe('getMessageReactions', () => {
    const validMessageId = 'msg123';
    const validUserAddress = 'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt';

    it('should successfully get message reactions', async () => {
      const mockReactions = [
        {
          emoji: '😀',
          reaction_count: '2',
          user_addresses: [validUserAddress, 'another-user'],
          first_reaction_at: new Date(),
          last_reaction_at: new Date()
        },
        {
          emoji: '❤️',
          reaction_count: '1',
          user_addresses: ['another-user'],
          first_reaction_at: new Date(),
          last_reaction_at: new Date()
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockReactions });

      const result = await reactionService.getMessageReactions(validMessageId, validUserAddress);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].emoji).toBe('😀');
      expect(result.data?.[0].count).toBe(2);
      expect(result.data?.[0].currentUserReacted).toBe(true);
      expect(result.data?.[1].currentUserReacted).toBe(false);
    });

    it('should return empty array for message with no reactions', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await reactionService.getMessageReactions(validMessageId, validUserAddress);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('getUserRecentEmojis', () => {
    const validUserAddress = 'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt';

    it('should successfully get user recent emojis', async () => {
      const mockRecentEmojis = [
        {
          emoji: '😀',
          usage_count: '5',
          last_used_at: new Date()
        },
        {
          emoji: '❤️',
          usage_count: '3',
          last_used_at: new Date()
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockRecentEmojis });

      const result = await reactionService.getUserRecentEmojis(validUserAddress, 8);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].emoji).toBe('😀');
      expect(result.data?.[0].usageCount).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM get_user_recent_emojis($1, $2)',
        [validUserAddress, 8]
      );
    });
  });

  describe('toggleReaction', () => {
    const validMessageId = 'msg123';
    const validUserAddress = 'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt';
    const validEmoji = '😀';

    it('should add reaction when not present', async () => {
      // Mock getMessageReactions returning no existing reaction
      mockQuery.mockResolvedValueOnce({ rows: [] });
      
      // Mock successful add reaction
      mockQuery.mockResolvedValueOnce({
        rows: [{ success: true, reaction_id: 'reaction123' }]
      });
      
      // Mock get reaction by ID
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'reaction123',
          message_id: validMessageId,
          user_address: validUserAddress,
          emoji: validEmoji,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const result = await reactionService.toggleReaction(validMessageId, validUserAddress, validEmoji);

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('added');
      expect(result.data?.reaction).toBeDefined();
    });

    it('should remove reaction when present', async () => {
      // Mock getMessageReactions returning existing reaction
      mockQuery.mockResolvedValueOnce({
        rows: [{
          emoji: validEmoji,
          reaction_count: '1',
          user_addresses: [validUserAddress],
          first_reaction_at: new Date(),
          last_reaction_at: new Date()
        }]
      });
      
      // Mock successful remove reaction
      mockQuery.mockResolvedValueOnce({
        rows: [{ success: true, error_message: 'Reaction removed successfully' }]
      });

      const result = await reactionService.toggleReaction(validMessageId, validUserAddress, validEmoji);

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('removed');
    });
  });

  describe('getReactionAnalytics', () => {
    it('should get global reaction analytics', async () => {
      const mockAnalytics = {
        total_reactions: '100',
        unique_emojis: '15',
        most_used_emoji: '😀'
      };

      const mockEmojiBreakdown = [
        { emoji: '😀', count: '25' },
        { emoji: '❤️', count: '20' },
        { emoji: '👍', count: '15' }
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [mockAnalytics] })
        .mockResolvedValueOnce({ rows: mockEmojiBreakdown });

      const result = await reactionService.getReactionAnalytics();

      expect(result.success).toBe(true);
      expect(result.data?.totalReactions).toBe(100);
      expect(result.data?.uniqueEmojis).toBe(15);
      expect(result.data?.mostUsedEmoji).toBe('😀');
      expect(result.data?.reactionsByEmoji).toEqual({
        '😀': 25,
        '❤️': 20,
        '👍': 15
      });
    });

    it('should get user-specific reaction analytics', async () => {
      const userAddress = 'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt';
      
      const mockAnalytics = {
        total_reactions: '25',
        unique_emojis: '8',
        most_used_emoji: '😀'
      };

      const mockEmojiBreakdown = [
        { emoji: '😀', count: '10' },
        { emoji: '❤️', count: '5' }
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [mockAnalytics] })
        .mockResolvedValueOnce({ rows: mockEmojiBreakdown });

      const result = await reactionService.getReactionAnalytics(userAddress);

      expect(result.success).toBe(true);
      expect(result.data?.totalReactions).toBe(25);
      expect(result.data?.uniqueEmojis).toBe(8);
    });
  });

  describe('getPopularEmojis', () => {
    it('should get popular emojis across platform', async () => {
      const mockPopularEmojis = [
        {
          emoji: '😀',
          usage_count: '100',
          unique_users: '50',
          unique_messages: '80'
        },
        {
          emoji: '❤️',
          usage_count: '85',
          unique_users: '40',
          unique_messages: '70'
        }
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockPopularEmojis });

      const result = await reactionService.getPopularEmojis(10);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].emoji).toBe('😀');
      expect(result.data?.[0].usageCount).toBe(100);
      expect(result.data?.[0].uniqueUsers).toBe(50);
    });
  });

  describe('emoji validation', () => {
    it('should accept valid Unicode emojis', async () => {
      const validEmojis = ['😀', '❤️', '👍', '🎉', '🔥'];
      
      for (const emoji of validEmojis) {
        // Mock successful database response
        mockQuery.mockResolvedValueOnce({
          rows: [{ success: true, reaction_id: 'reaction123' }]
        });
        
        mockQuery.mockResolvedValueOnce({
          rows: [{
            id: 'reaction123',
            message_id: 'msg123',
            user_address: 'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt',
            emoji: emoji,
            created_at: new Date(),
            updated_at: new Date()
          }]
        });

        const result = await reactionService.addReaction(
          'msg123',
          'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt',
          emoji
        );

        expect(result.success).toBe(true);
      }
    });

    it('should accept valid text emojis', async () => {
      const validTextEmojis = [':)', ':D', ':P', '<3', ':heart:'];
      
      for (const emoji of validTextEmojis) {
        // Mock successful database response
        mockQuery.mockResolvedValueOnce({
          rows: [{ success: true, reaction_id: 'reaction123' }]
        });
        
        mockQuery.mockResolvedValueOnce({
          rows: [{
            id: 'reaction123',
            message_id: 'msg123',
            user_address: 'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt',
            emoji: emoji,
            created_at: new Date(),
            updated_at: new Date()
          }]
        });

        const result = await reactionService.addReaction(
          'msg123',
          'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt',
          emoji
        );

        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid emojis', async () => {
      const invalidEmojis = ['abc', '123', 'invalid'];
      
      for (const emoji of invalidEmojis) {
        const result = await reactionService.addReaction(
          'msg123',
          'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt',
          emoji
        );

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('Invalid emoji format');
      }
    });
  });

  describe('wallet address validation', () => {
    it('should accept valid Solana wallet addresses', async () => {
      const validAddresses = [
        'Eq9jbEPLN8Y8Qv1mwMqtGZfFNGMXQYYwTtqiKjGsN3Qt',
        '11111111111111111111111111111111',
        'DjVE6JNiYqPL2QXyCUUh8rNjHrbz6hXHNwkTtcxjCiHY'
      ];

      for (const address of validAddresses) {
        // Mock successful database response
        mockQuery.mockResolvedValueOnce({
          rows: [{ success: true, reaction_id: 'reaction123' }]
        });
        
        mockQuery.mockResolvedValueOnce({
          rows: [{
            id: 'reaction123',
            message_id: 'msg123',
            user_address: address,
            emoji: '😀',
            created_at: new Date(),
            updated_at: new Date()
          }]
        });

        const result = await reactionService.addReaction('msg123', address, '😀');

        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid wallet addresses', async () => {
      const invalidAddresses = [
        'invalid',
        '123',
        'too-short',
        'this-address-is-way-too-long-to-be-a-valid-solana-address'
      ];

      for (const address of invalidAddresses) {
        const result = await reactionService.addReaction('msg123', address, '😀');

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('Invalid wallet address');
      }
    });
  });
});