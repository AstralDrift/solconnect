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