# SolConnect Message Search Implementation

## Overview

This document describes the full-text message search functionality implemented for SolConnect, providing users with the ability to search across all their encrypted messages with advanced filtering and privacy-preserving architecture.

## Architecture

### Components

1. **Database Layer**
   - PostgreSQL full-text search with custom configuration
   - Temporary encrypted content storage with auto-expiration
   - Search history and analytics tracking
   - Optimized indexes for performance

2. **Service Layer**
   - `SecureMessageSearchService`: Client-side encryption-aware search
   - `MessageSearchIntegrationService`: Bridges secure search with database
   - `DatabaseService`: Extended with search methods

3. **UI Components**
   - `SearchBar`: Real-time search input with suggestions
   - `SearchResults`: Result display with highlighting
   - Search page with advanced filtering

4. **Hooks**
   - `useMessageSearch`: Search integration hook
   - `useSearchHistory`: Search history management
   - `useSearchSuggestions`: Real-time suggestions

## Key Features

### Security & Privacy

- **Client-Side Decryption**: Messages are decrypted only for search, never stored in plaintext
- **Temporary Indexing**: Search content expires after 24 hours
- **User Isolation**: Users can only search their own messages
- **Secure Caching**: Search results cached with encryption

### Search Capabilities

- **Full-Text Search**: PostgreSQL-powered text search with relevance ranking
- **Advanced Filters**: Date ranges, senders, sessions, content types
- **Search Suggestions**: Real-time autocomplete based on history
- **Result Highlighting**: Context-aware snippet generation
- **Recency Bias**: Recent messages ranked higher

### Performance

- **Sub-100ms Response**: Optimized database queries and indexes
- **Batch Indexing**: Efficient message indexing in batches
- **Smart Caching**: Results cached to reduce redundant searches
- **Automatic Cleanup**: Expired content cleaned up periodically

## Database Schema

### Tables

1. **message_search_content**
   ```sql
   - message_id (UUID, FK to messages)
   - decrypted_content (TEXT)
   - content_tokens (tsvector)
   - created_at (TIMESTAMP)
   - expires_at (TIMESTAMP)
   ```

2. **search_history**
   ```sql
   - id (UUID)
   - user_wallet (VARCHAR)
   - search_query (TEXT)
   - filters (JSONB)
   - result_count (INTEGER)
   - executed_at (TIMESTAMP)
   - search_duration_ms (INTEGER)
   ```

3. **search_analytics**
   ```sql
   - date (DATE)
   - hour (INTEGER)
   - total_searches (INTEGER)
   - unique_users (INTEGER)
   - avg_result_count (DECIMAL)
   - avg_search_duration_ms (INTEGER)
   ```

### Indexes

- GIN index on `content_tokens` for full-text search
- Trigram index on `decrypted_content` for fuzzy search
- B-tree indexes on timestamps and user fields

## Usage

### Basic Search

```typescript
import { useMessageSearch } from '@/hooks/useMessageSearch';

const { searchMessages, isReady } = useMessageSearch();

const results = await searchMessages('hello world', {
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date()
  },
  senders: ['wallet123']
});
```

### Message Indexing

Messages are automatically indexed when:
- New messages arrive
- Messages are decrypted for viewing
- Batch indexing is triggered for a session

```typescript
const { indexMessage, indexSession } = useMessageSearch();

// Index a single message
await indexMessage(messageId, sessionId);

// Index all messages in a session
await indexSession(sessionId);
```

### Search Page

Navigate to `/search` from the chat list to access the full search interface with:
- Real-time search suggestions
- Search history
- Advanced filtering options
- Result highlighting

## Implementation Details

### Search Flow

1. User enters search query
2. Query is processed and filters applied
3. Database search executed on indexed content
4. Results enhanced with decrypted content
5. Relevance scoring and ranking applied
6. Results displayed with highlighting

### Indexing Flow

1. Message received/decrypted
2. Content temporarily indexed with TTL
3. PostgreSQL full-text vectors generated
4. Search analytics updated
5. Expired content cleaned up after 24 hours

### Privacy Considerations

- Decrypted content is only stored temporarily (24 hours)
- Search operations require authentication
- No logging of search content
- Automatic cleanup of expired data
- User can clear search history at any time

## Performance Optimizations

1. **Database Optimizations**
   - Custom text search configuration
   - Optimized relevance ranking
   - Efficient pagination
   - Connection pooling

2. **Client Optimizations**
   - Debounced search input
   - Result caching
   - Batch message indexing
   - Lazy loading of results

3. **Architecture Optimizations**
   - Hybrid search approach (database + client-side)
   - Smart fallback mechanisms
   - Parallel processing where possible

## Migration

To enable search functionality:

1. Run the database migration:
   ```bash
   psql -d solconnect_dev -f database/migrations/001_add_search_tables.sql
   ```

2. Index existing messages (optional):
   ```typescript
   const { indexSession } = useMessageSearch();
   await indexSession(sessionId);
   ```

## Testing

Run the test suite:
```bash
npm test -- src/services/search/__tests__/
```

Key test areas:
- Search accuracy and relevance
- Encryption/decryption handling
- Performance under load
- Privacy and security
- Error handling

## Future Enhancements

- Semantic search using AI/ML
- Voice search integration
- Search result export
- Advanced search operators
- Cross-device search sync
- Real-time collaborative search

## Troubleshooting

### Common Issues

1. **No search results**
   - Ensure messages are indexed
   - Check PostgreSQL full-text search configuration
   - Verify user permissions

2. **Slow search performance**
   - Check database indexes
   - Monitor search analytics
   - Consider increasing cache TTL

3. **Indexing failures**
   - Verify encryption keys available
   - Check database connectivity
   - Monitor error logs

### Debug Commands

```sql
-- Check indexed messages
SELECT COUNT(*) FROM message_search_content WHERE expires_at > NOW();

-- View search analytics
SELECT * FROM search_metrics_overview;

-- Manual cleanup
SELECT cleanup_expired_search_content();
``` 