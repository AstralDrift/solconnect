/**
 * ReactionService - Handles emoji reactions for messages
 * Provides business logic for adding, removing, and querying reactions
 */

import { Result, SolConnectError, ErrorCategory, ErrorCode, createResult } from '@/types/errors';
import { Logger } from './monitoring/Logger';
import { getDatabaseService } from './database/DatabaseService';

export interface MessageReaction {
  id: string;
  messageId: string;
  userAddress: string;
  emoji: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  userAddresses: string[];
  firstReactionAt: Date;
  lastReactionAt: Date;
  currentUserReacted: boolean;
}

export interface ReactionAnalytics {
  totalReactions: number;
  uniqueEmojis: number;
  mostUsedEmoji: string;
  reactionsByEmoji: Record<string, number>;
}

export interface UserEmojiHistory {
  emoji: string;
  usageCount: number;
  lastUsedAt: Date;
}

export class ReactionService {
  private logger = new Logger('ReactionService');
  private databaseService = getDatabaseService();

  /**
   * Add a reaction to a message
   */
  async addReaction(
    messageId: string,
    userAddress: string,
    emoji: string
  ): Promise<Result<MessageReaction>> {
    this.logger.info('Adding reaction to message', { messageId, userAddress, emoji });

    try {
      // Validate emoji input
      const emojiValidation = this.validateEmoji(emoji);
      if (!emojiValidation.success) {
        return emojiValidation;
      }

      // Validate user address
      if (!this.isValidWalletAddress(userAddress)) {
        return createResult.error(
          new SolConnectError(
            ErrorCategory.VALIDATION,
            ErrorCode.INVALID_WALLET_ADDRESS,
            `Invalid wallet address: ${userAddress}`,
            'Please ensure you have a valid wallet address.',
            false,
            { userAddress, messageId, emoji }
          )
        );
      }

      // Use database stored procedure to add reaction with validation
      const query = 'SELECT * FROM add_reaction($1, $2, $3)';
      const result = await this.databaseService.pool.query(query, [messageId, userAddress, emoji]);
      
      const dbResult = result.rows[0];
      if (!dbResult.success) {
        return createResult.error(
          new SolConnectError(
            ErrorCategory.VALIDATION,
            ErrorCode.INVALID_MESSAGE_FORMAT,
            `Failed to add reaction: ${dbResult.error_message}`,
            dbResult.error_message === 'Reaction already exists' 
              ? 'You have already reacted with this emoji.'
              : 'Unable to add reaction. Please try again.',
            true,
            { messageId, userAddress, emoji, dbError: dbResult.error_message }
          )
        );
      }

      // Fetch the created reaction
      const reactionResult = await this.getReactionById(dbResult.reaction_id);
      if (!reactionResult.success) {
        return reactionResult;
      }

      this.logger.info('Reaction added successfully', { 
        reactionId: dbResult.reaction_id, 
        messageId, 
        userAddress, 
        emoji 
      });

      return createResult.success(reactionResult.data!);
    } catch (error) {
      this.logger.error('Failed to add reaction', error);
      return createResult.error(
        new SolConnectError(
          ErrorCategory.SYSTEM,
          ErrorCode.STORAGE_ERROR,
          `Failed to add reaction: ${error.message}`,
          'Unable to add reaction. Please try again.',
          true,
          { messageId, userAddress, emoji, originalError: error.message }
        )
      );
    }
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(
    messageId: string,
    userAddress: string,
    emoji: string
  ): Promise<Result<void>> {
    this.logger.info('Removing reaction from message', { messageId, userAddress, emoji });

    try {
      // Use database stored procedure to remove reaction
      const query = 'SELECT * FROM remove_reaction($1, $2, $3)';
      const result = await this.databaseService.pool.query(query, [messageId, userAddress, emoji]);
      
      const dbResult = result.rows[0];
      if (!dbResult.success) {
        return createResult.error(
          new SolConnectError(
            ErrorCategory.VALIDATION,
            ErrorCode.INVALID_MESSAGE_FORMAT,
            `Failed to remove reaction: ${dbResult.error_message}`,
            dbResult.error_message === 'Reaction not found'
              ? 'Reaction not found or already removed.'
              : 'Unable to remove reaction. Please try again.',
            true,
            { messageId, userAddress, emoji, dbError: dbResult.error_message }
          )
        );
      }

      this.logger.info('Reaction removed successfully', { messageId, userAddress, emoji });
      return createResult.success(undefined);
    } catch (error) {
      this.logger.error('Failed to remove reaction', error);
      return createResult.error(
        new SolConnectError(
          ErrorCategory.SYSTEM,
          ErrorCode.STORAGE_ERROR,
          `Failed to remove reaction: ${error.message}`,
          'Unable to remove reaction. Please try again.',
          true,
          { messageId, userAddress, emoji, originalError: error.message }
        )
      );
    }
  }

  /**
   * Get all reactions for a message with summary data
   */
  async getMessageReactions(
    messageId: string,
    currentUserAddress?: string
  ): Promise<Result<ReactionSummary[]>> {
    this.logger.debug('Getting reactions for message', { messageId });

    try {
      // Use database function to get reaction summary
      const query = 'SELECT * FROM get_message_reactions($1)';
      const result = await this.databaseService.pool.query(query, [messageId]);

      const reactions: ReactionSummary[] = result.rows.map(row => ({
        emoji: row.emoji,
        count: parseInt(row.reaction_count),
        userAddresses: row.user_addresses,
        firstReactionAt: new Date(row.first_reaction_at),
        lastReactionAt: new Date(row.last_reaction_at),
        currentUserReacted: currentUserAddress ? row.user_addresses.includes(currentUserAddress) : false
      }));

      this.logger.debug('Retrieved reactions for message', { messageId, reactionCount: reactions.length });
      return createResult.success(reactions);
    } catch (error) {
      this.logger.error('Failed to get message reactions', error);
      return createResult.error(
        new SolConnectError(
          ErrorCategory.SYSTEM,
          ErrorCode.STORAGE_ERROR,
          `Failed to get reactions for message: ${error.message}`,
          'Unable to load reactions. Please try again.',
          true,
          { messageId, originalError: error.message }
        )
      );
    }
  }

  /**
   * Get user's recent emoji usage for quick access
   */
  async getUserRecentEmojis(
    userAddress: string,
    limit: number = 8
  ): Promise<Result<UserEmojiHistory[]>> {
    this.logger.debug('Getting user recent emojis', { userAddress, limit });

    try {
      const query = 'SELECT * FROM get_user_recent_emojis($1, $2)';
      const result = await this.databaseService.pool.query(query, [userAddress, limit]);

      const emojis: UserEmojiHistory[] = result.rows.map(row => ({
        emoji: row.emoji,
        usageCount: parseInt(row.usage_count),
        lastUsedAt: new Date(row.last_used_at)
      }));

      this.logger.debug('Retrieved user recent emojis', { userAddress, emojiCount: emojis.length });
      return createResult.success(emojis);
    } catch (error) {
      this.logger.error('Failed to get user recent emojis', error);
      return createResult.error(
        new SolConnectError(
          ErrorCategory.SYSTEM,
          ErrorCode.STORAGE_ERROR,
          `Failed to get recent emojis: ${error.message}`,
          'Unable to load recent emojis. Please try again.',
          true,
          { userAddress, originalError: error.message }
        )
      );
    }
  }

  /**
   * Get reaction analytics for a user or globally
   */
  async getReactionAnalytics(
    userAddress?: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<Result<ReactionAnalytics>> {
    this.logger.debug('Getting reaction analytics', { userAddress, timeframe });

    try {
      let query: string;
      let params: any[];

      if (userAddress) {
        // User-specific analytics
        query = `
          SELECT 
            COUNT(*) as total_reactions,
            COUNT(DISTINCT emoji) as unique_emojis,
            mode() WITHIN GROUP (ORDER BY emoji) as most_used_emoji
          FROM message_reactions 
          WHERE user_address = $1
        `;
        params = [userAddress];

        if (timeframe) {
          query += ' AND created_at BETWEEN $2 AND $3';
          params.push(timeframe.start, timeframe.end);
        }
      } else {
        // Global analytics
        query = `
          SELECT 
            COUNT(*) as total_reactions,
            COUNT(DISTINCT emoji) as unique_emojis,
            mode() WITHIN GROUP (ORDER BY emoji) as most_used_emoji
          FROM message_reactions 
        `;
        params = [];

        if (timeframe) {
          query += ' WHERE created_at BETWEEN $1 AND $2';
          params.push(timeframe.start, timeframe.end);
        }
      }

      const analyticsResult = await this.databaseService.pool.query(query, params);
      const analytics = analyticsResult.rows[0];

      // Get emoji breakdown
      let emojiQuery: string;
      let emojiParams: any[];

      if (userAddress) {
        emojiQuery = `
          SELECT emoji, COUNT(*) as count
          FROM message_reactions 
          WHERE user_address = $1
        `;
        emojiParams = [userAddress];

        if (timeframe) {
          emojiQuery += ' AND created_at BETWEEN $2 AND $3';
          emojiParams.push(timeframe.start, timeframe.end);
        }
      } else {
        emojiQuery = `
          SELECT emoji, COUNT(*) as count
          FROM message_reactions 
        `;
        emojiParams = [];

        if (timeframe) {
          emojiQuery += ' WHERE created_at BETWEEN $1 AND $2';
          emojiParams.push(timeframe.start, timeframe.end);
        }
      }

      emojiQuery += ' GROUP BY emoji ORDER BY count DESC';

      const emojiResult = await this.databaseService.pool.query(emojiQuery, emojiParams);
      const reactionsByEmoji: Record<string, number> = {};
      
      emojiResult.rows.forEach(row => {
        reactionsByEmoji[row.emoji] = parseInt(row.count);
      });

      const result: ReactionAnalytics = {
        totalReactions: parseInt(analytics.total_reactions) || 0,
        uniqueEmojis: parseInt(analytics.unique_emojis) || 0,
        mostUsedEmoji: analytics.most_used_emoji || '',
        reactionsByEmoji
      };

      this.logger.debug('Retrieved reaction analytics', { 
        userAddress, 
        totalReactions: result.totalReactions,
        uniqueEmojis: result.uniqueEmojis 
      });

      return createResult.success(result);
    } catch (error) {
      this.logger.error('Failed to get reaction analytics', error);
      return createResult.error(
        new SolConnectError(
          ErrorCategory.SYSTEM,
          ErrorCode.STORAGE_ERROR,
          `Failed to get reaction analytics: ${error.message}`,
          'Unable to load analytics. Please try again.',
          true,
          { userAddress, originalError: error.message }
        )
      );
    }
  }

  /**
   * Toggle a reaction (add if not present, remove if present)
   */
  async toggleReaction(
    messageId: string,
    userAddress: string,
    emoji: string
  ): Promise<Result<{ action: 'added' | 'removed'; reaction?: MessageReaction }>> {
    this.logger.info('Toggling reaction', { messageId, userAddress, emoji });

    try {
      // Check if reaction already exists
      const existingReactions = await this.getMessageReactions(messageId, userAddress);
      if (!existingReactions.success) {
        return createResult.error(existingReactions.error!);
      }

      const existingReaction = existingReactions.data!.find(
        r => r.emoji === emoji && r.currentUserReacted
      );

      if (existingReaction) {
        // Remove existing reaction
        const removeResult = await this.removeReaction(messageId, userAddress, emoji);
        if (!removeResult.success) {
          return createResult.error(removeResult.error!);
        }

        this.logger.info('Reaction toggled (removed)', { messageId, userAddress, emoji });
        return createResult.success({ action: 'removed' });
      } else {
        // Add new reaction
        const addResult = await this.addReaction(messageId, userAddress, emoji);
        if (!addResult.success) {
          return createResult.error(addResult.error!);
        }

        this.logger.info('Reaction toggled (added)', { messageId, userAddress, emoji });
        return createResult.success({ action: 'added', reaction: addResult.data });
      }
    } catch (error) {
      this.logger.error('Failed to toggle reaction', error);
      return createResult.error(
        new SolConnectError(
          ErrorCategory.SYSTEM,
          ErrorCode.STORAGE_ERROR,
          `Failed to toggle reaction: ${error.message}`,
          'Unable to toggle reaction. Please try again.',
          true,
          { messageId, userAddress, emoji, originalError: error.message }
        )
      );
    }
  }

  /**
   * Get popular emojis across the platform
   */
  async getPopularEmojis(limit: number = 20): Promise<Result<Array<{
    emoji: string;
    usageCount: number;
    uniqueUsers: number;
    uniqueMessages: number;
  }>>> {
    this.logger.debug('Getting popular emojis', { limit });

    try {
      const query = `
        SELECT emoji, usage_count, unique_users, unique_messages
        FROM popular_emojis
        ORDER BY usage_count DESC
        LIMIT $1
      `;

      const result = await this.databaseService.pool.query(query, [limit]);

      const popularEmojis = result.rows.map(row => ({
        emoji: row.emoji,
        usageCount: parseInt(row.usage_count),
        uniqueUsers: parseInt(row.unique_users),
        uniqueMessages: parseInt(row.unique_messages)
      }));

      this.logger.debug('Retrieved popular emojis', { count: popularEmojis.length });
      return createResult.success(popularEmojis);
    } catch (error) {
      this.logger.error('Failed to get popular emojis', error);
      return createResult.error(
        new SolConnectError(
          ErrorCategory.SYSTEM,
          ErrorCode.STORAGE_ERROR,
          `Failed to get popular emojis: ${error.message}`,
          'Unable to load popular emojis. Please try again.',
          true,
          { originalError: error.message }
        )
      );
    }
  }

  // Private helper methods

  /**
   * Get a reaction by its ID
   */
  private async getReactionById(reactionId: string): Promise<Result<MessageReaction>> {
    try {
      const query = `
        SELECT id, message_id, user_address, emoji, created_at, updated_at
        FROM message_reactions
        WHERE id = $1
      `;

      const result = await this.databaseService.pool.query(query, [reactionId]);

      if (result.rows.length === 0) {
        return createResult.error(
          new SolConnectError(
            ErrorCategory.VALIDATION,
            ErrorCode.INVALID_MESSAGE_FORMAT,
            `Reaction not found: ${reactionId}`,
            'Reaction not found.',
            false,
            { reactionId }
          )
        );
      }

      const row = result.rows[0];
      const reaction: MessageReaction = {
        id: row.id,
        messageId: row.message_id,
        userAddress: row.user_address,
        emoji: row.emoji,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };

      return createResult.success(reaction);
    } catch (error) {
      return createResult.error(
        new SolConnectError(
          ErrorCategory.SYSTEM,
          ErrorCode.STORAGE_ERROR,
          `Failed to get reaction by ID: ${error.message}`,
          'Unable to retrieve reaction. Please try again.',
          true,
          { reactionId, originalError: error.message }
        )
      );
    }
  }

  /**
   * Validate emoji format and content
   */
  private validateEmoji(emoji: string): Result<void> {
    if (!emoji || emoji.trim().length === 0) {
      return createResult.error(
        new SolConnectError(
          ErrorCategory.VALIDATION,
          ErrorCode.INVALID_MESSAGE_FORMAT,
          'Emoji cannot be empty',
          'Please select a valid emoji.',
          false,
          { emoji }
        )
      );
    }

    if (emoji.length > 10) {
      return createResult.error(
        new SolConnectError(
          ErrorCategory.VALIDATION,
          ErrorCode.INVALID_MESSAGE_FORMAT,
          `Emoji too long: ${emoji.length} characters`,
          'Emoji must be 10 characters or less.',
          false,
          { emoji, length: emoji.length }
        )
      );
    }

    // Basic emoji validation - check if it contains emoji-like unicode characters
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    if (!emojiRegex.test(emoji) && !this.isTextEmoji(emoji)) {
      return createResult.error(
        new SolConnectError(
          ErrorCategory.VALIDATION,
          ErrorCode.INVALID_MESSAGE_FORMAT,
          `Invalid emoji format: ${emoji}`,
          'Please select a valid emoji.',
          false,
          { emoji }
        )
      );
    }

    return createResult.success(undefined);
  }

  /**
   * Check if text is a valid text-based emoji (like :), :P, etc.)
   */
  private isTextEmoji(text: string): boolean {
    const textEmojis = [
      ':)', ':D', ':P', ':O', ':(', ';)', ':/', ':|', 
      '<3', '</3', ':heart:', ':thumbsup:', ':thumbsdown:',
      ':fire:', ':100:', ':ok_hand:', ':clap:', ':raised_hands:'
    ];
    return textEmojis.includes(text);
  }

  /**
   * Validate Solana wallet address format
   */
  private isValidWalletAddress(address: string): boolean {
    // Solana addresses are base58 encoded and typically 32-44 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  }
}

// Singleton instance
let reactionService: ReactionService | null = null;

export function getReactionService(): ReactionService {
  if (!reactionService) {
    reactionService = new ReactionService();
  }
  return reactionService;
}