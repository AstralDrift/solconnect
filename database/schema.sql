-- SolConnect Database Schema
-- Purpose: Message persistence, analytics, and relay coordination

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (maps wallet addresses to user metadata)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Device registry for tracking message sources and sync state
CREATE TABLE IF NOT EXISTS device_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(255) UNIQUE NOT NULL,
    wallet_address VARCHAR(44) NOT NULL,
    device_name VARCHAR(100),
    platform VARCHAR(50), -- 'web', 'ios', 'android'
    user_agent TEXT,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (wallet_address) REFERENCES users(wallet_address) ON DELETE CASCADE
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    created_by VARCHAR(44) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Session participants
CREATE TABLE IF NOT EXISTS session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    wallet_address VARCHAR(44) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(session_id, wallet_address)
);

-- Messages table (for persistence and history) - Enhanced for offline sync
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(255) UNIQUE NOT NULL,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender_address VARCHAR(44) NOT NULL,
    recipient_address VARCHAR(44),
    device_id VARCHAR(255) NOT NULL, -- Source device for conflict resolution
    sequence_number BIGINT NOT NULL, -- Per-session sequence number
    content TEXT NOT NULL, -- Encrypted content
    content_type VARCHAR(50) DEFAULT 'text',
    signature TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL, -- Client timestamp
    server_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Server-assigned timestamp
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict', 'failed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure sequence numbers are unique per session
    UNIQUE(session_id, sequence_number),
    FOREIGN KEY (device_id) REFERENCES device_registry(device_id) ON DELETE RESTRICT
);

-- Sync state tracking for offline synchronization
CREATE TABLE IF NOT EXISTS sync_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    last_synced_sequence BIGINT DEFAULT 0, -- Last sequence number synced to this device
    last_known_sequence BIGINT DEFAULT 0, -- Highest sequence number known by this device
    sync_vector JSONB DEFAULT '{}'::jsonb, -- Vector clock for conflict resolution
    pending_message_ids TEXT[] DEFAULT '{}', -- Array of message IDs waiting for delivery
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, device_id),
    FOREIGN KEY (device_id) REFERENCES device_registry(device_id) ON DELETE CASCADE
);

-- Message delivery status
CREATE TABLE IF NOT EXISTS message_delivery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    recipient_address VARCHAR(44) NOT NULL,
    device_id VARCHAR(255), -- Target device (NULL means all devices)
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'delivered', 'read', 'failed')),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, recipient_address, device_id)
);

-- Relay server registry
CREATE TABLE IF NOT EXISTS relay_servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id VARCHAR(255) UNIQUE NOT NULL,
    url TEXT NOT NULL,
    region VARCHAR(50),
    capacity INTEGER DEFAULT 1000,
    current_connections INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    health_check_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics: Message metrics
CREATE TABLE IF NOT EXISTS message_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour < 24),
    total_messages INTEGER DEFAULT 0,
    unique_senders INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    avg_delivery_time_ms INTEGER,
    failed_messages INTEGER DEFAULT 0,
    offline_messages INTEGER DEFAULT 0, -- Messages sent while offline
    sync_conflicts INTEGER DEFAULT 0, -- Number of sync conflicts resolved
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, hour)
);

-- Indexes for performance
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_sender ON messages(sender_address);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_server_timestamp ON messages(server_timestamp DESC);
CREATE INDEX idx_messages_sequence ON messages(session_id, sequence_number);
CREATE INDEX idx_messages_device_sync ON messages(device_id, sync_status);
CREATE INDEX idx_message_delivery_status ON message_delivery(status);
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_session_participants_wallet ON session_participants(wallet_address);
CREATE INDEX idx_device_registry_wallet ON device_registry(wallet_address);
CREATE INDEX idx_device_registry_last_seen ON device_registry(last_seen_at DESC);
CREATE INDEX idx_sync_state_session_device ON sync_state(session_id, device_id);
CREATE INDEX idx_sync_state_last_sync ON sync_state(last_sync_at DESC);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to get next sequence number for a session
CREATE OR REPLACE FUNCTION get_next_sequence_number(p_session_id UUID)
RETURNS BIGINT AS $$
DECLARE
    next_seq BIGINT;
BEGIN
    SELECT COALESCE(MAX(sequence_number), 0) + 1 
    INTO next_seq 
    FROM messages 
    WHERE session_id = p_session_id;
    
    RETURN next_seq;
END;
$$ language 'plpgsql';

-- Function to update sync state after message insert
CREATE OR REPLACE FUNCTION update_sync_state_on_message_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Update sync state for the sending device
    INSERT INTO sync_state (session_id, device_id, last_synced_sequence, last_known_sequence)
    VALUES (NEW.session_id, NEW.device_id, NEW.sequence_number, NEW.sequence_number)
    ON CONFLICT (session_id, device_id) 
    DO UPDATE SET 
        last_known_sequence = GREATEST(sync_state.last_known_sequence, NEW.sequence_number),
        last_sync_at = NOW(),
        updated_at = NOW();
    
    -- Update sync vector for all other devices in the session
    UPDATE sync_state 
    SET last_known_sequence = GREATEST(last_known_sequence, NEW.sequence_number),
        updated_at = NOW()
    WHERE session_id = NEW.session_id 
    AND device_id != NEW.device_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_registry_updated_at BEFORE UPDATE ON device_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_state_updated_at BEFORE UPDATE ON sync_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_delivery_updated_at BEFORE UPDATE ON message_delivery
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_relay_servers_updated_at BEFORE UPDATE ON relay_servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update sync state when messages are inserted
CREATE TRIGGER messages_update_sync_state AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_sync_state_on_message_insert();

-- Views for common queries
CREATE VIEW active_sessions AS
SELECT 
    cs.id,
    cs.session_id,
    cs.created_by,
    cs.created_at,
    COUNT(DISTINCT sp.wallet_address) as participant_count,
    MAX(m.timestamp) as last_message_at,
    MAX(m.sequence_number) as last_sequence_number
FROM chat_sessions cs
LEFT JOIN session_participants sp ON cs.id = sp.session_id AND sp.is_active = true
LEFT JOIN messages m ON cs.id = m.session_id
WHERE cs.is_active = true
GROUP BY cs.id, cs.session_id, cs.created_by, cs.created_at;

CREATE VIEW user_message_stats AS
SELECT 
    u.wallet_address,
    u.display_name,
    COUNT(DISTINCT m.id) as total_messages,
    COUNT(DISTINCT m.session_id) as total_sessions,
    COUNT(DISTINCT m.device_id) as devices_used,
    MIN(m.timestamp) as first_message_at,
    MAX(m.timestamp) as last_message_at
FROM users u
LEFT JOIN messages m ON u.wallet_address = m.sender_address
GROUP BY u.wallet_address, u.display_name;

-- View for sync status monitoring
CREATE VIEW sync_status_overview AS
SELECT 
    cs.session_id,
    COUNT(DISTINCT ss.device_id) as total_devices,
    MIN(ss.last_synced_sequence) as min_synced_sequence,
    MAX(ss.last_synced_sequence) as max_synced_sequence,
    MAX(m.sequence_number) as latest_sequence,
    CASE 
        WHEN MIN(ss.last_synced_sequence) = MAX(m.sequence_number) THEN 'fully_synced'
        WHEN MAX(ss.last_synced_sequence) = MAX(m.sequence_number) THEN 'partially_synced'
        ELSE 'behind'
    END as sync_status
FROM chat_sessions cs
LEFT JOIN sync_state ss ON cs.id = ss.session_id
LEFT JOIN messages m ON cs.id = m.session_id
WHERE cs.is_active = true
GROUP BY cs.id, cs.session_id;

-- Sample data for testing (commented out by default)
/*
INSERT INTO users (wallet_address, display_name) VALUES
    ('11111111111111111111111111111111', 'Alice'),
    ('22222222222222222222222222222222', 'Bob');

INSERT INTO device_registry (device_id, wallet_address, device_name, platform) VALUES
    ('alice-web-001', '11111111111111111111111111111111', 'Alice Web Browser', 'web'),
    ('bob-mobile-001', '22222222222222222222222222222222', 'Bob iPhone', 'ios');

INSERT INTO relay_servers (server_id, url, region, is_active) VALUES
    ('relay-1', 'ws://localhost:8080', 'us-west', true);
*/ 

-- ===================================================================
-- SEARCH FUNCTIONALITY TABLES AND INDEXES
-- ===================================================================

-- Enable PostgreSQL full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Decrypted message content for search (stored separately for security)
-- Note: This table should only contain temporarily decrypted content
-- with automatic cleanup policies
CREATE TABLE IF NOT EXISTS message_search_content (
    message_id UUID PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    decrypted_content TEXT NOT NULL,
    content_tokens tsvector, -- PostgreSQL full-text search vector
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours' -- Auto-expire after 24h
);

-- Full-text search index
CREATE INDEX idx_message_search_content_fts ON message_search_content 
USING GIN(content_tokens);

-- Trigram index for fuzzy search
CREATE INDEX idx_message_search_content_trgm ON message_search_content 
USING GIN(decrypted_content gin_trgm_ops);

-- Expiration index for cleanup
CREATE INDEX idx_message_search_content_expires ON message_search_content(expires_at);

-- Search history for user experience and analytics
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_wallet VARCHAR(44) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    result_count INTEGER,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    search_duration_ms INTEGER
);

-- Indexes for search history
CREATE INDEX idx_search_history_user ON search_history(user_wallet, executed_at DESC);
CREATE INDEX idx_search_history_query ON search_history USING GIN(search_query gin_trgm_ops);

-- Search analytics aggregated data
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

-- Index for analytics queries
CREATE INDEX idx_search_analytics_date ON search_analytics(date DESC, hour);

-- Custom text search configuration for SolConnect
CREATE TEXT SEARCH CONFIGURATION solconnect_search (COPY = pg_catalog.english);

-- Add custom stop words for chat context
ALTER TEXT SEARCH CONFIGURATION solconnect_search
    ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part
    WITH english_stem;

-- Function to update message search vector
CREATE OR REPLACE FUNCTION update_message_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_tokens = to_tsvector('solconnect_search', NEW.decrypted_content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search vectors
CREATE TRIGGER message_search_vector_update
    BEFORE INSERT OR UPDATE ON message_search_content
    FOR EACH ROW EXECUTE FUNCTION update_message_search_vector();

-- Function to clean up expired search content
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

-- Function to perform secure message search
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
        -- Get all sessions the user participates in
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
                32 /* cover density ranking */
            ) * (
                -- Recency bias: more recent messages get higher scores
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

-- View for search analytics dashboard
CREATE VIEW search_metrics_overview AS
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

-- Scheduled cleanup job (to be run by external scheduler)
-- Example: DELETE FROM message_search_content WHERE expires_at < NOW();

-- ===================================================================
-- MESSAGE REACTIONS FUNCTIONALITY
-- ===================================================================

-- Message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_address VARCHAR(44) NOT NULL,
    emoji VARCHAR(10) NOT NULL, -- Unicode emoji (up to 10 chars for complex emoji)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one reaction per user per emoji per message
    UNIQUE(message_id, user_address, emoji),
    
    -- Foreign key to ensure user exists
    FOREIGN KEY (user_address) REFERENCES users(wallet_address) ON DELETE CASCADE
);

-- Indexes for message reactions performance
CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user ON message_reactions(user_address);
CREATE INDEX idx_message_reactions_emoji ON message_reactions(emoji);
CREATE INDEX idx_message_reactions_created_at ON message_reactions(created_at DESC);

-- View for reaction summary per message
CREATE VIEW message_reaction_summary AS
SELECT 
    message_id,
    emoji,
    COUNT(*) as reaction_count,
    ARRAY_AGG(user_address ORDER BY created_at) as user_addresses,
    MIN(created_at) as first_reaction_at,
    MAX(created_at) as last_reaction_at
FROM message_reactions
GROUP BY message_id, emoji;

-- View for user reaction statistics
CREATE VIEW user_reaction_stats AS
SELECT 
    user_address,
    COUNT(DISTINCT message_id) as messages_reacted_to,
    COUNT(*) as total_reactions,
    COUNT(DISTINCT emoji) as unique_emojis_used,
    ARRAY_AGG(DISTINCT emoji ORDER BY COUNT(*) DESC) as most_used_emojis
FROM message_reactions
GROUP BY user_address;

-- View for popular emojis across the platform
CREATE VIEW popular_emojis AS
SELECT 
    emoji,
    COUNT(*) as usage_count,
    COUNT(DISTINCT user_address) as unique_users,
    COUNT(DISTINCT message_id) as unique_messages,
    MIN(created_at) as first_used_at,
    MAX(created_at) as last_used_at
FROM message_reactions
GROUP BY emoji
ORDER BY usage_count DESC;

-- Function to validate emoji (basic Unicode check)
CREATE OR REPLACE FUNCTION is_valid_emoji(emoji_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic validation: check length and that it's not empty
    IF emoji_text IS NULL OR LENGTH(emoji_text) = 0 OR LENGTH(emoji_text) > 10 THEN
        RETURN FALSE;
    END IF;
    
    -- Additional validation could be added here for specific emoji ranges
    -- For now, we'll allow any Unicode text up to 10 characters
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to add a reaction (with validation)
CREATE OR REPLACE FUNCTION add_reaction(
    p_message_id UUID,
    p_user_address VARCHAR(44),
    p_emoji VARCHAR(10)
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT,
    reaction_id UUID
) AS $$
DECLARE
    v_reaction_id UUID;
    v_message_exists BOOLEAN;
    v_user_exists BOOLEAN;
BEGIN
    -- Validate emoji
    IF NOT is_valid_emoji(p_emoji) THEN
        RETURN QUERY SELECT FALSE, 'Invalid emoji format', NULL::UUID;
        RETURN;
    END IF;
    
    -- Check if message exists and user has access to it
    SELECT EXISTS(
        SELECT 1 FROM messages m
        JOIN session_participants sp ON m.session_id = sp.session_id
        WHERE m.id = p_message_id 
        AND sp.wallet_address = p_user_address 
        AND sp.is_active = true
    ) INTO v_message_exists;
    
    IF NOT v_message_exists THEN
        RETURN QUERY SELECT FALSE, 'Message not found or access denied', NULL::UUID;
        RETURN;
    END IF;
    
    -- Try to insert the reaction
    BEGIN
        INSERT INTO message_reactions (message_id, user_address, emoji)
        VALUES (p_message_id, p_user_address, p_emoji)
        RETURNING id INTO v_reaction_id;
        
        RETURN QUERY SELECT TRUE, 'Reaction added successfully', v_reaction_id;
    EXCEPTION 
        WHEN unique_violation THEN
            RETURN QUERY SELECT FALSE, 'Reaction already exists', NULL::UUID;
        WHEN foreign_key_violation THEN
            RETURN QUERY SELECT FALSE, 'User not found', NULL::UUID;
        WHEN OTHERS THEN
            RETURN QUERY SELECT FALSE, 'Database error: ' || SQLERRM, NULL::UUID;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove a reaction
CREATE OR REPLACE FUNCTION remove_reaction(
    p_message_id UUID,
    p_user_address VARCHAR(44),
    p_emoji VARCHAR(10)
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Remove the reaction
    DELETE FROM message_reactions
    WHERE message_id = p_message_id 
    AND user_address = p_user_address 
    AND emoji = p_emoji;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    IF v_deleted_count > 0 THEN
        RETURN QUERY SELECT TRUE, 'Reaction removed successfully';
    ELSE
        RETURN QUERY SELECT FALSE, 'Reaction not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get reactions for a message
CREATE OR REPLACE FUNCTION get_message_reactions(p_message_id UUID)
RETURNS TABLE (
    emoji VARCHAR(10),
    reaction_count BIGINT,
    user_addresses VARCHAR(44)[],
    first_reaction_at TIMESTAMP WITH TIME ZONE,
    last_reaction_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mrs.emoji,
        mrs.reaction_count,
        mrs.user_addresses,
        mrs.first_reaction_at,
        mrs.last_reaction_at
    FROM message_reaction_summary mrs
    WHERE mrs.message_id = p_message_id
    ORDER BY mrs.first_reaction_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's recent emojis
CREATE OR REPLACE FUNCTION get_user_recent_emojis(
    p_user_address VARCHAR(44),
    p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (
    emoji VARCHAR(10),
    usage_count BIGINT,
    last_used_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.emoji,
        COUNT(*) as usage_count,
        MAX(mr.created_at) as last_used_at
    FROM message_reactions mr
    WHERE mr.user_address = p_user_address
    GROUP BY mr.emoji
    ORDER BY MAX(mr.created_at) DESC, COUNT(*) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_message_reactions_updated_at 
    BEFORE UPDATE ON message_reactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add reaction analytics to message metrics (optional enhancement)
-- This could be used for tracking reaction usage patterns
CREATE TABLE IF NOT EXISTS reaction_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour < 24),
    emoji VARCHAR(10) NOT NULL,
    total_reactions INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    unique_messages INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, hour, emoji)
);

CREATE INDEX idx_reaction_metrics_date ON reaction_metrics(date DESC, hour);
CREATE INDEX idx_reaction_metrics_emoji ON reaction_metrics(emoji); 