import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import { NextPage } from 'next';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { MessageSearchIntegrationService } from '@/services/search/MessageSearchIntegrationService';
import { getDatabaseService } from '@/services/database/DatabaseService';
import { useAppSelector } from '@/store';
import { Logger } from '@/services/monitoring/Logger';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const logger = new Logger('SearchPage');

interface SearchState {
  query: string;
  results: any[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  searchTime: number;
}

const SearchPage: NextPage = () => {
  const router = useRouter();
  const user = useAppSelector(state => state.auth.user);
  
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    results: [],
    loading: false,
    error: null,
    hasMore: false,
    totalCount: 0,
    searchTime: 0
  });

  const [searchService, setSearchService] = useState<MessageSearchIntegrationService | null>(null);

  // Initialize search service
  useEffect(() => {
    const initSearchService = async () => {
      try {
        const databaseService = getDatabaseService();
        // Note: CryptoService would be initialized from the app context
        const cryptoService = (window as any).__cryptoService;
        
        if (cryptoService) {
          const service = new MessageSearchIntegrationService(cryptoService, databaseService);
          setSearchService(service);
        }
      } catch (error) {
        logger.error('Failed to initialize search service', error);
      }
    };

    initSearchService();
  }, []);

  // Handle search
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !user?.walletAddress || !searchService) {
      return;
    }

    setSearchState(prev => ({
      ...prev,
      query,
      loading: true,
      error: null
    }));

    try {
      const result = await searchService.searchMessages({
        text: query,
        filters: {},
        userId: user.walletAddress,
        maxResults: 50
      });

      if (result.success) {
        setSearchState(prev => ({
          ...prev,
          results: result.data.results,
          totalCount: result.data.totalCount,
          hasMore: result.data.hasMore,
          searchTime: result.data.searchTime,
          loading: false
        }));
      } else {
        setSearchState(prev => ({
          ...prev,
          error: result.error?.message || 'Search failed',
          loading: false
        }));
      }
    } catch (error) {
      logger.error('Search failed', error);
      setSearchState(prev => ({
        ...prev,
        error: 'An unexpected error occurred',
        loading: false
      }));
    }
  }, [user?.walletAddress, searchService]);

  // Handle clear search
  const handleClear = useCallback(() => {
    setSearchState({
      query: '',
      results: [],
      loading: false,
      error: null,
      hasMore: false,
      totalCount: 0,
      searchTime: 0
    });
  }, []);

  // Handle result click
  const handleResultClick = useCallback((messageId: string, sessionId: string) => {
    // Navigate to the chat thread with the message
    router.push(`/thread/${sessionId}?messageId=${messageId}`);
  }, [router]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    // TODO: Implement pagination
    logger.info('Load more not yet implemented');
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ← Back
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Search Messages
            </h1>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <SearchBar
            onSearch={handleSearch}
            onClear={handleClear}
            placeholder="Search your messages..."
            autoFocus
            showSuggestions
            showHistory
            className="mb-4"
          />
          
          {searchState.searchTime > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Found {searchState.totalCount} results in {searchState.searchTime}ms
            </p>
          )}
        </div>

        {/* Results Section */}
        {searchState.loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {searchState.error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6">
            {searchState.error}
          </div>
        )}

        {!searchState.loading && searchState.results.length === 0 && searchState.query && (
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No results found for "{searchState.query}"
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Try different keywords or check your filters
            </p>
          </div>
        )}

        {!searchState.loading && searchState.results.length > 0 && (
          <SearchResults
            results={{
              results: searchState.results,
              totalCount: searchState.totalCount,
              searchTime: searchState.searchTime,
              hasMore: searchState.hasMore
            }}
            onLoadMore={handleLoadMore}
            onResultClick={handleResultClick}
          />
        )}

        {/* Empty State */}
        {!searchState.query && !searchState.loading && (
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Search your conversations
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Find messages across all your chats. Use keywords, phrases, or advanced filters to narrow down your search.
            </p>
            
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-left">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Search Tips
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>• Use quotes for exact phrases</li>
                  <li>• Search by sender name</li>
                  <li>• Filter by date range</li>
                </ul>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-left">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Recent Searches
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Your search history will appear here
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage; 