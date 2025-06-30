import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ClockIcon, 
  UserIcon, 
  ChatBubbleLeftRightIcon,
  FunnelIcon,
  ArrowDownIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { format, formatDistanceToNow } from 'date-fns';

export interface SearchResult {
  messageId: string;
  sessionId: string;
  senderAddress: string;
  decryptedContent: string;
  timestamp: Date;
  relevanceScore: number;
  highlights: string[];
  rank?: number;
}

export interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  error?: string;
  totalCount: number;
  hasMore: boolean;
  onLoadMore: () => void;
  onResultClick: (result: SearchResult) => void;
  onJumpToMessage: (messageId: string, sessionId: string) => void;
  searchTime?: number;
  className?: string;
}

/**
 * UX-first search results with infinite scroll and result highlighting
 */
export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  loading,
  error,
  totalCount,
  hasMore,
  onLoadMore,
  onResultClick,
  onJumpToMessage,
  searchTime,
  className = ""
}) => {
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('detailed');
  const observerRef = useRef<IntersectionObserver>();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  const lastResultElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        onLoadMore();
      }
    }, { threshold: 0.1 });
    
    if (node) observerRef.current.observe(node);
  }, [loading, hasMore, onLoadMore]);

  // Format wallet address for display
  const formatWalletAddress = useCallback((address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  // Format search time
  const formatSearchTime = useCallback((time?: number) => {
    if (!time) return '';
    return time < 1000 ? `${Math.round(time)}ms` : `${(time / 1000).toFixed(1)}s`;
  }, []);

  // Handle result click
  const handleResultClick = useCallback((result: SearchResult) => {
    setSelectedResult(result.messageId);
    onResultClick(result);
  }, [onResultClick]);

  // Handle jump to message
  const handleJumpToMessage = useCallback((result: SearchResult) => {
    onJumpToMessage(result.messageId, result.sessionId);
  }, [onJumpToMessage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedResult(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Search Error</h3>
        <p className="text-gray-500 text-center max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Search Stats Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            {loading ? 'Searching...' : `${totalCount} result${totalCount !== 1 ? 's' : ''} found`}
          </span>
          {searchTime && (
            <span className="text-xs text-gray-400">
              in {formatSearchTime(searchTime)}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'compact' ? 'detailed' : 'compact')}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            title={`Switch to ${viewMode === 'compact' ? 'detailed' : 'compact'} view`}
          >
            <FunnelIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No messages found</h3>
            <p className="text-gray-500 max-w-md">
              Try adjusting your search terms or filters to find what you&apos;re looking for.
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {results.map((result, index) => (
              <div
                key={result.messageId}
                ref={index === results.length - 1 ? lastResultElementRef : undefined}
                className={`
                  group cursor-pointer border rounded-lg transition-all duration-200
                  ${selectedResult === result.messageId 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 bg-white/90 hover:bg-gray-50 hover:shadow-sm'
                  }
                  ${viewMode === 'compact' ? 'p-3' : 'p-4'}
                `}
                onClick={() => handleResultClick(result)}
              >
                {/* Result Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <UserIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900">
                      {formatWalletAddress(result.senderAddress)}
                    </span>
                    {result.rank && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        #{result.rank}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <ClockIcon className="w-3 h-3" />
                    <span title={format(result.timestamp, 'PPpp')}>
                      {formatDistanceToNow(result.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Message Content with Highlights */}
                <div className={`${viewMode === 'compact' ? 'text-sm' : 'text-base'} text-gray-900 mb-3`}>
                  {result.highlights.length > 0 ? (
                    <div className="space-y-2">
                      {result.highlights.map((highlight, idx) => (
                        <div
                          key={idx}
                          className="leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: highlight }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="leading-relaxed">
                      {result.decryptedContent.length > 200 
                        ? `${result.decryptedContent.substring(0, 200)}...`
                        : result.decryptedContent
                      }
                    </p>
                  )}
                </div>

                {/* Result Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1 text-xs text-gray-400">
                    <span>Relevance: {result.relevanceScore}</span>
                    <span>•</span>
                    <span>Session: {result.sessionId.slice(0, 8)}...</span>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJumpToMessage(result);
                    }}
                    className={`
                      opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      text-xs text-blue-600 hover:text-blue-800 font-medium
                      px-2 py-1 rounded hover:bg-blue-100
                    `}
                  >
                    Jump to message
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading More Indicator */}
        {loading && (
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center space-x-2 text-gray-500">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="text-sm">Loading more results...</span>
            </div>
          </div>
        )}

        {/* Load More Button */}
        {!loading && hasMore && (
          <div className="p-4 border-t border-gray-200">
            <button
              ref={loadMoreRef}
              onClick={onLoadMore}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              <ArrowDownIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Load more results</span>
            </button>
          </div>
        )}

        {/* End of Results */}
        {!loading && !hasMore && results.length > 0 && (
          <div className="text-center p-6 text-sm text-gray-500 border-t border-gray-200">
            You&apos;ve reached the end of the search results
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      {results.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Showing {results.length} of {totalCount} results</span>
            {searchTime && (
              <span>Search completed in {formatSearchTime(searchTime)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};