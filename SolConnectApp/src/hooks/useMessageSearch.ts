import { useCallback, useEffect, useRef } from 'react';
import { MessageSearchIntegrationService } from '@/services/search/MessageSearchIntegrationService';
import { getDatabaseService } from '@/services/database/DatabaseService';
import { useAppSelector } from '@/store';
import { Logger } from '@/services/monitoring/Logger';

const logger = new Logger('useMessageSearch');

interface UseMessageSearchOptions {
  autoIndex?: boolean;
  indexBatchSize?: number;
}

/**
 * Hook for integrating message search functionality
 */
export function useMessageSearch(options: UseMessageSearchOptions = {}) {
  const { autoIndex = true, indexBatchSize = 10 } = options;
  
  const user = useAppSelector(state => state.auth.user);
  const searchServiceRef = useRef<MessageSearchIntegrationService | null>(null);
  const indexQueueRef = useRef<Array<{ messageId: string; sessionId: string }>>([]); 
  const isProcessingRef = useRef(false);

  // Initialize search service
  useEffect(() => {
    const initSearchService = async () => {
      try {
        const databaseService = getDatabaseService();
        const cryptoService = (window as any).__cryptoService;
        
        if (cryptoService && user?.walletAddress) {
          searchServiceRef.current = new MessageSearchIntegrationService(
            cryptoService,
            databaseService
          );
          
          logger.info('Search service initialized');
        }
      } catch (error) {
        logger.error('Failed to initialize search service', error);
      }
    };

    initSearchService();
  }, [user?.walletAddress]);

  // Process index queue
  const processIndexQueue = useCallback(async () => {
    if (
      isProcessingRef.current || 
      !searchServiceRef.current || 
      !user?.walletAddress ||
      indexQueueRef.current.length === 0
    ) {
      return;
    }

    isProcessingRef.current = true;

    try {
      // Process in batches
      const batch = indexQueueRef.current.splice(0, indexBatchSize);
      
      await Promise.all(
        batch.map(async ({ messageId, sessionId }) => {
          try {
            await searchServiceRef.current!.indexMessage(
              messageId,
              sessionId,
              user.walletAddress
            );
          } catch (error) {
            logger.error('Failed to index message', { messageId, error });
          }
        })
      );

      // Process remaining items
      if (indexQueueRef.current.length > 0) {
        setTimeout(processIndexQueue, 100);
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [user?.walletAddress, indexBatchSize]);

  // Index a message
  const indexMessage = useCallback(async (messageId: string, sessionId: string) => {
    if (!autoIndex || !searchServiceRef.current || !user?.walletAddress) {
      return;
    }

    // Add to queue
    indexQueueRef.current.push({ messageId, sessionId });
    
    // Trigger processing
    processIndexQueue();
  }, [autoIndex, user?.walletAddress, processIndexQueue]);

  // Search messages
  const searchMessages = useCallback(async (query: string, filters?: any) => {
    if (!searchServiceRef.current || !user?.walletAddress) {
      return {
        success: false,
        error: new Error('Search service not initialized')
      };
    }

    return await searchServiceRef.current.searchMessages({
      text: query,
      filters: filters || {},
      userId: user.walletAddress,
      maxResults: 50
    });
  }, [user?.walletAddress]);

  // Index all messages in a session
  const indexSession = useCallback(async (sessionId: string) => {
    if (!searchServiceRef.current || !user?.walletAddress) {
      return {
        success: false,
        error: new Error('Search service not initialized')
      };
    }

    logger.info('Indexing session for search', { sessionId });
    
    return await searchServiceRef.current.indexSessionMessages(
      sessionId,
      user.walletAddress,
      100
    );
  }, [user?.walletAddress]);

  // Get search suggestions
  const getSearchSuggestions = useCallback(async (partialQuery: string) => {
    if (!searchServiceRef.current || !user?.walletAddress) {
      return { success: true, data: [] };
    }

    return await searchServiceRef.current.getSearchSuggestions(
      user.walletAddress,
      partialQuery
    );
  }, [user?.walletAddress]);

  // Clear search history
  const clearSearchHistory = useCallback(async () => {
    if (!searchServiceRef.current || !user?.walletAddress) {
      return {
        success: false,
        error: new Error('Search service not initialized')
      };
    }

    return await searchServiceRef.current.clearSearchHistory(user.walletAddress);
  }, [user?.walletAddress]);

  // Clean up expired search content
  const cleanupExpiredContent = useCallback(async () => {
    if (!searchServiceRef.current) {
      return {
        success: false,
        error: new Error('Search service not initialized')
      };
    }

    return await searchServiceRef.current.cleanupExpiredContent();
  }, []);

  // Set up periodic cleanup
  useEffect(() => {
    if (!searchServiceRef.current) {
      return;
    }

    // Run cleanup every hour
    const interval = setInterval(() => {
      cleanupExpiredContent();
    }, 60 * 60 * 1000);

    // Initial cleanup
    cleanupExpiredContent();

    return () => clearInterval(interval);
  }, [cleanupExpiredContent]);

  return {
    indexMessage,
    searchMessages,
    indexSession,
    getSearchSuggestions,
    clearSearchHistory,
    cleanupExpiredContent,
    isReady: !!searchServiceRef.current
  };
} 