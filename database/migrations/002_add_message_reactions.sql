-- Migration: Add Message Reactions Support
-- Description: Adds tables, indexes, views, and functions for emoji reactions to messages
-- Version: 002
-- Date: 2025-06-29

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
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_address);
CREATE INDEX IF NOT EXISTS idx_message_reactions_emoji ON message_reactions(emoji);
CREATE INDEX IF NOT EXISTS idx_message_reactions_created_at ON message_reactions(created_at DESC);

-- View for reaction summary per message
CREATE OR REPLACE VIEW message_reaction_summary AS
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
CREATE OR REPLACE VIEW user_reaction_stats AS
SELECT 
    user_address,
    COUNT(DISTINCT message_id) as messages_reacted_to,
    COUNT(*) as total_reactions,
    COUNT(DISTINCT emoji) as unique_emojis_used,
    ARRAY_AGG(DISTINCT emoji ORDER BY COUNT(*) DESC) as most_used_emojis
FROM message_reactions
GROUP BY user_address;

-- View for popular emojis across the platform
CREATE OR REPLACE VIEW popular_emojis AS
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
DROP TRIGGER IF EXISTS update_message_reactions_updated_at ON message_reactions;
CREATE TRIGGER update_message_reactions_updated_at 
    BEFORE UPDATE ON message_reactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Reaction analytics table (optional enhancement)
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

CREATE INDEX IF NOT EXISTS idx_reaction_metrics_date ON reaction_metrics(date DESC, hour);
CREATE INDEX IF NOT EXISTS idx_reaction_metrics_emoji ON reaction_metrics(emoji);

-- Migration metadata
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES ('002', 'Add message reactions support', NOW())
ON CONFLICT (version) DO NOTHING;