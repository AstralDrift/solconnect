import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { getDatabaseService } from '../services/database/DatabaseService';
import { useAppSelector } from '../store';

export interface SearchSuggestion {
  text: string;
  type: 'suggestion' | 'history' | 'recent';
  frequency?: number;
}

/**
 * Hook for getting real-time search suggestions
 */
export function useSearchSuggestions(query: string, enabled: boolean = true) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const user = useAppSelector(state => state.auth.user);
  const debouncedQuery = useDebounce(query, 300);

  const fetchSuggestions = useCallback(async () => {
    if (!enabled || !user?.walletAddress || debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const databaseService = getDatabaseService();
      const result = await databaseService.getSearchSuggestions(
        user.walletAddress,
        debouncedQuery,
        5
      );

      if (result.success) {
        setSuggestions(result.data);
      } else {
        setError(result.error || new Error('Failed to fetch suggestions'));
        setSuggestions([]);
      }
    } catch (err) {
      setError(err as Error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, enabled, user?.walletAddress]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return {
    suggestions,
    loading,
    error,
    refresh: fetchSuggestions
  };
}

// Hook for debouncing values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}