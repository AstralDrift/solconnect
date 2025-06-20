import { useState, useEffect, useCallback } from 'react';

const SEARCH_HISTORY_KEY = 'solconnect_search_history';
const MAX_HISTORY_ITEMS = 20;

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  frequency: number;
}

/**
 * Hook for managing search history with intelligent ranking
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load search history from storage on mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  // Load search history from localStorage/AsyncStorage
  const loadSearchHistory = useCallback(async () => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        const historyData: SearchHistoryItem[] = JSON.parse(stored);
        
        // Sort by frequency and recency, then extract queries
        const sortedQueries = historyData
          .sort((a, b) => {
            // Weight frequency and recency
            const scoreA = a.frequency * 0.7 + (a.timestamp / Date.now()) * 0.3;
            const scoreB = b.frequency * 0.7 + (b.timestamp / Date.now()) * 0.3;
            return scoreB - scoreA;
          })
          .map(item => item.query);
        
        setHistory(sortedQueries);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save search history to storage
  const saveSearchHistory = useCallback(async (historyData: SearchHistoryItem[]) => {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(historyData));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, []);

  // Add query to search history
  const addToHistory = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) return;

    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      let historyData: SearchHistoryItem[] = stored ? JSON.parse(stored) : [];

      // Find existing entry
      const existingIndex = historyData.findIndex(item => 
        item.query.toLowerCase() === query.toLowerCase()
      );

      if (existingIndex >= 0) {
        // Update existing entry
        historyData[existingIndex] = {
          ...historyData[existingIndex],
          timestamp: Date.now(),
          frequency: historyData[existingIndex].frequency + 1
        };
      } else {
        // Add new entry
        historyData.unshift({
          query: query.trim(),
          timestamp: Date.now(),
          frequency: 1
        });
      }

      // Limit history size
      if (historyData.length > MAX_HISTORY_ITEMS) {
        // Remove oldest items with lowest frequency
        historyData = historyData
          .sort((a, b) => {
            const scoreA = a.frequency * 0.7 + (a.timestamp / Date.now()) * 0.3;
            const scoreB = b.frequency * 0.7 + (b.timestamp / Date.now()) * 0.3;
            return scoreB - scoreA;
          })
          .slice(0, MAX_HISTORY_ITEMS);
      }

      await saveSearchHistory(historyData);
      
      // Update local state
      const sortedQueries = historyData
        .sort((a, b) => {
          const scoreA = a.frequency * 0.7 + (a.timestamp / Date.now()) * 0.3;
          const scoreB = b.frequency * 0.7 + (b.timestamp / Date.now()) * 0.3;
          return scoreB - scoreA;
        })
        .map(item => item.query);
      
      setHistory(sortedQueries);
    } catch (error) {
      console.error('Failed to add to search history:', error);
    }
  }, [saveSearchHistory]);

  // Remove specific query from history
  const removeFromHistory = useCallback(async (queryToRemove: string) => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!stored) return;

      let historyData: SearchHistoryItem[] = JSON.parse(stored);
      historyData = historyData.filter(item => 
        item.query.toLowerCase() !== queryToRemove.toLowerCase()
      );

      await saveSearchHistory(historyData);
      
      const queries = historyData
        .sort((a, b) => {
          const scoreA = a.frequency * 0.7 + (a.timestamp / Date.now()) * 0.3;
          const scoreB = b.frequency * 0.7 + (b.timestamp / Date.now()) * 0.3;
          return scoreB - scoreA;
        })
        .map(item => item.query);
      
      setHistory(queries);
    } catch (error) {
      console.error('Failed to remove from search history:', error);
    }
  }, [saveSearchHistory]);

  // Clear all search history
  const clearHistory = useCallback(async () => {
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
      setHistory([]);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }, []);

  // Get search suggestions based on history
  const getHistorySuggestions = useCallback((query: string): string[] => {
    if (!query.trim()) return history.slice(0, 5);

    const lowerQuery = query.toLowerCase();
    return history
      .filter(item => item.toLowerCase().includes(lowerQuery))
      .slice(0, 5);
  }, [history]);

  // Get most frequent searches
  const getFrequentSearches = useCallback((): string[] => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!stored) return [];

      const historyData: SearchHistoryItem[] = JSON.parse(stored);
      return historyData
        .filter(item => item.frequency > 1) // Only items searched more than once
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10)
        .map(item => item.query);
    } catch (error) {
      console.error('Failed to get frequent searches:', error);
      return [];
    }
  }, []);

  // Get recent searches (last 24 hours)
  const getRecentSearches = useCallback((): string[] => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!stored) return [];

      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const historyData: SearchHistoryItem[] = JSON.parse(stored);
      
      return historyData
        .filter(item => item.timestamp > oneDayAgo)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10)
        .map(item => item.query);
    } catch (error) {
      console.error('Failed to get recent searches:', error);
      return [];
    }
  }, []);

  // Clean up old history entries (older than 30 days)
  const cleanupHistory = useCallback(async () => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!stored) return;

      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      let historyData: SearchHistoryItem[] = JSON.parse(stored);
      
      // Remove old entries, but keep frequent ones
      historyData = historyData.filter(item => 
        item.timestamp > thirtyDaysAgo || item.frequency >= 3
      );

      await saveSearchHistory(historyData);
      
      const queries = historyData
        .sort((a, b) => {
          const scoreA = a.frequency * 0.7 + (a.timestamp / Date.now()) * 0.3;
          const scoreB = b.frequency * 0.7 + (b.timestamp / Date.now()) * 0.3;
          return scoreB - scoreA;
        })
        .map(item => item.query);
      
      setHistory(queries);
    } catch (error) {
      console.error('Failed to cleanup search history:', error);
    }
  }, [saveSearchHistory]);

  // Run cleanup on mount and periodically
  useEffect(() => {
    const cleanup = () => {
      cleanupHistory();
    };

    // Cleanup on mount
    cleanup();

    // Setup periodic cleanup (once per day)
    const interval = setInterval(cleanup, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [cleanupHistory]);

  return {
    history,
    loading,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getHistorySuggestions,
    getFrequentSearches,
    getRecentSearches
  };
}