import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SearchIcon, XMarkIcon, ClockIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSearchSuggestions } from '@/hooks/useSearchSuggestions';
import { useSearchHistory } from '@/hooks/useSearchHistory';

export interface SearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  placeholder?: string;
  initialValue?: string;
  autoFocus?: boolean;
  showSuggestions?: boolean;
  showHistory?: boolean;
  className?: string;
}

export interface SearchSuggestion {
  text: string;
  type: 'suggestion' | 'history' | 'recent';
  icon?: React.ReactNode;
  frequency?: number;
}

/**
 * UX-first search bar with real-time suggestions and keyboard navigation
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onClear,
  placeholder = "Search messages...",
  initialValue = "",
  autoFocus = false,
  showSuggestions = true,
  showHistory = true,
  className = ""
}) => {
  const [query, setQuery] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Custom hooks for suggestions and history
  const { suggestions, loading: suggestionsLoading } = useSearchSuggestions(query);
  const { history, addToHistory, clearHistory } = useSearchHistory();

  // Combine suggestions and history
  const combinedSuggestions: SearchSuggestion[] = React.useMemo(() => {
    const items: SearchSuggestion[] = [];
    
    // Add search history if query is empty or matches
    if (showHistory && query.length === 0) {
      items.push(...history.slice(0, 5).map(item => ({
        text: item,
        type: 'history' as const,
        icon: <ClockIcon className="w-4 h-4 text-gray-400" />
      })));
    }
    
    // Add real-time suggestions
    if (showSuggestions && query.length > 0) {
      items.push(...suggestions.map(suggestion => ({
        text: suggestion,
        type: 'suggestion' as const,
        icon: <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
      })));
    }
    
    return items;
  }, [query, suggestions, history, showHistory, showSuggestions]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Handle input changes with debounced suggestions
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedSuggestionIndex(-1);
    
    if (value.length > 0 || showHistory) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, [showHistory]);

  // Handle search execution
  const executeSearch = useCallback((searchQuery: string) => {
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
      addToHistory(searchQuery.trim());
      setShowDropdown(false);
      setIsFocused(false);
      inputRef.current?.blur();
    }
  }, [onSearch, addToHistory]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && combinedSuggestions[selectedSuggestionIndex]) {
          executeSearch(combinedSuggestions[selectedSuggestionIndex].text);
        } else {
          executeSearch(query);
        }
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          Math.min(prev + 1, combinedSuggestions.length - 1)
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => Math.max(prev - 1, -1));
        break;
        
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setSelectedSuggestionIndex(-1);
        inputRef.current?.blur();
        break;
        
      case 'Tab':
        if (selectedSuggestionIndex >= 0 && combinedSuggestions[selectedSuggestionIndex]) {
          e.preventDefault();
          setQuery(combinedSuggestions[selectedSuggestionIndex].text);
          setSelectedSuggestionIndex(-1);
        }
        break;
    }
  }, [query, selectedSuggestionIndex, combinedSuggestions, executeSearch]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    executeSearch(suggestion.text);
  }, [executeSearch]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (combinedSuggestions.length > 0 || query.length === 0) {
      setShowDropdown(true);
    }
  }, [combinedSuggestions.length, query.length]);

  // Handle input blur with delay to allow suggestion clicks
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setIsFocused(false);
      setShowDropdown(false);
      setSelectedSuggestionIndex(-1);
    }, 150);
  }, []);

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    setShowDropdown(false);
    setSelectedSuggestionIndex(-1);
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSelectedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="h-5 w-5 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`
            block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            bg-white/90 backdrop-blur-sm
            placeholder-gray-500 text-gray-900
            transition-all duration-200
            ${isFocused ? 'shadow-lg ring-2 ring-blue-500' : 'shadow-sm'}
          `}
          autoComplete="off"
          spellCheck="false"
        />
        
        {/* Clear Button */}
        {query && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-150"
              type="button"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showDropdown && (combinedSuggestions.length > 0 || suggestionsLoading) && (
        <div
          ref={dropdownRef}
          className={`
            absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-sm border border-gray-200 
            rounded-lg shadow-lg max-h-64 overflow-y-auto
            animate-in fade-in slide-in-from-top-2 duration-200
          `}
        >
          {/* Loading State */}
          {suggestionsLoading && (
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
              Loading suggestions...
            </div>
          )}

          {/* Suggestions List */}
          {!suggestionsLoading && combinedSuggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.text}-${index}`}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`
                w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50
                transition-colors duration-150 flex items-center
                ${index === selectedSuggestionIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}
                ${index === 0 ? 'rounded-t-lg' : ''}
                ${index === combinedSuggestions.length - 1 ? 'rounded-b-lg' : ''}
              `}
              type="button"
            >
              <span className="mr-3 flex-shrink-0">
                {suggestion.icon}
              </span>
              <span className="flex-1 text-sm">
                {suggestion.text}
              </span>
              {suggestion.type === 'history' && (
                <span className="text-xs text-gray-400 ml-2">Recent</span>
              )}
            </button>
          ))}

          {/* Empty State */}
          {!suggestionsLoading && combinedSuggestions.length === 0 && query.length > 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No suggestions found
            </div>
          )}

          {/* Clear History Option */}
          {showHistory && history.length > 0 && query.length === 0 && (
            <div className="border-t border-gray-100 px-4 py-2">
              <button
                onClick={clearHistory}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors duration-150"
                type="button"
              >
                Clear search history
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search Keyboard Shortcuts Tooltip */}
      {isFocused && (
        <div className="absolute right-0 top-full mt-1 z-40">
          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">
            Press Enter to search • Use ↑↓ to navigate • Tab to complete
          </div>
        </div>
      )}
    </div>
  );
};