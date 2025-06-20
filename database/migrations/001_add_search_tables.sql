-- Migration: Add Search Functionality Tables and Indexes
-- Version: 001
-- Date: 2024-01-10
-- Description: Adds full-text search capability to SolConnect

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create message search content table
CREATE TABLE IF NOT EXISTS message_search_content (
    message_id UUID PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    decrypted_content TEXT NOT NULL,
    content_tokens tsvector,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- Create search indexes
CREATE INDEX IF NOT EXISTS idx_message_search_content_fts 
    ON message_search_content USING GIN(content_tokens);

CREATE INDEX IF NOT EXISTS idx_message_search_content_trgm 
    ON message_search_content USING GIN(decrypted_content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_message_search_content_expires 
    ON message_search_content(expires_at);

-- Create search history table
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_wallet VARCHAR(44) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    result_count INTEGER,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    search_duration_ms INTEGER
);

-- Create search history indexes
CREATE INDEX IF NOT EXISTS idx_search_history_user 
    ON search_history(user_wallet, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_history_query 
    ON search_history USING GIN(search_query gin_trgm_ops);

-- Create search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour < 24),
    total_searches INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    avg_result_count DECIMAL(10,2),
    avg_search_duration_ms INTEGER,
    popular_terms JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, hour)
);

-- Create analytics index
CREATE INDEX IF NOT EXISTS idx_search_analytics_date 
    ON search_analytics(date DESC, hour);

-- Create custom text search configuration
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'solconnect_search'
    ) THEN
        CREATE TEXT SEARCH CONFIGURATION solconnect_search (COPY = pg_catalog.english);
        
        ALTER TEXT SEARCH CONFIGURATION solconnect_search
            ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part
            WITH english_stem;
    END IF;
END
$$;

-- Drop functions if they exist (for idempotency)
DROP FUNCTION IF EXISTS update_message_search_vector() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_search_content();
DROP FUNCTION IF EXISTS search_messages(VARCHAR, TEXT, UUID[], VARCHAR[], TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, INTEGER);

-- Create search vector update function
CREATE OR REPLACE FUNCTION update_message_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_tokens = to_tsvector('solconnect_search', NEW.decrypted_content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search vector updates
DROP TRIGGER IF EXISTS message_search_vector_update ON message_search_content;
CREATE TRIGGER message_search_vector_update
    BEFORE INSERT OR UPDATE ON message_search_content
    FOR EACH ROW EXECUTE FUNCTION update_message_search_vector();

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_search_content()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM message_search_content
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create secure message search function
CREATE OR REPLACE FUNCTION search_messages(
    p_user_wallet VARCHAR(44),
    p_search_query TEXT,
    p_session_ids UUID[] DEFAULT NULL,
    p_sender_addresses VARCHAR(44)[] DEFAULT NULL,
    p_date_from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_date_to TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    message_id UUID,
    session_id UUID,
    sender_address VARCHAR(44),
    timestamp TIMESTAMP WITH TIME ZONE,
    relevance_score REAL,
    headline TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_sessions AS (
        SELECT DISTINCT cs.id
        FROM chat_sessions cs
        JOIN session_participants sp ON cs.id = sp.session_id
        WHERE sp.wallet_address = p_user_wallet AND sp.is_active = true
    ),
    ranked_messages AS (
        SELECT 
            m.id,
            m.session_id,
            m.sender_address,
            m.timestamp,
            ts_rank_cd(
                msc.content_tokens, 
                websearch_to_tsquery('solconnect_search', p_search_query),
                32
            ) * (
                CASE 
                    WHEN m.timestamp > NOW() - INTERVAL '7 days' THEN 2.0
                    WHEN m.timestamp > NOW() - INTERVAL '30 days' THEN 1.5
                    WHEN m.timestamp > NOW() - INTERVAL '90 days' THEN 1.2
                    ELSE 1.0
                END
            ) AS rank_score,
            ts_headline(
                'solconnect_search',
                msc.decrypted_content,
                websearch_to_tsquery('solconnect_search', p_search_query),
                'MaxWords=50, MinWords=10, MaxFragments=3'
            ) AS search_headline
        FROM messages m
        JOIN message_search_content msc ON m.id = msc.message_id
        JOIN user_sessions us ON m.session_id = us.id
        WHERE 
            msc.content_tokens @@ websearch_to_tsquery('solconnect_search', p_search_query)
            AND (p_session_ids IS NULL OR m.session_id = ANY(p_session_ids))
            AND (p_sender_addresses IS NULL OR m.sender_address = ANY(p_sender_addresses))
            AND (p_date_from IS NULL OR m.timestamp >= p_date_from)
            AND (p_date_to IS NULL OR m.timestamp <= p_date_to)
    )
    SELECT 
        rm.id,
        rm.session_id,
        rm.sender_address,
        rm.timestamp,
        rm.rank_score,
        rm.search_headline
    FROM ranked_messages rm
    ORDER BY rm.rank_score DESC, rm.timestamp DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create search metrics view
CREATE OR REPLACE VIEW search_metrics_overview AS
SELECT 
    date,
    SUM(total_searches) as daily_searches,
    SUM(unique_users) as daily_unique_users,
    AVG(avg_result_count) as avg_results_per_search,
    AVG(avg_search_duration_ms) as avg_search_time_ms
FROM search_analytics
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;

-- Add comment
COMMENT ON TABLE message_search_content IS 'Temporary storage for decrypted message content for search indexing. Content expires after 24 hours for privacy.'; 