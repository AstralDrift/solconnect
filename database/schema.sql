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

-- Messages table (for persistence and history)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(255) UNIQUE NOT NULL,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender_address VARCHAR(44) NOT NULL,
    recipient_address VARCHAR(44),
    content TEXT NOT NULL, -- Encrypted content
    content_type VARCHAR(50) DEFAULT 'text',
    signature TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message delivery status
CREATE TABLE IF NOT EXISTS message_delivery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    recipient_address VARCHAR(44) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'delivered', 'read', 'failed')),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, recipient_address)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, hour)
);

-- Indexes for performance
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_sender ON messages(sender_address);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_message_delivery_status ON message_delivery(status);
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_session_participants_wallet ON session_participants(wallet_address);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_delivery_updated_at BEFORE UPDATE ON message_delivery
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_relay_servers_updated_at BEFORE UPDATE ON relay_servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE VIEW active_sessions AS
SELECT 
    cs.id,
    cs.session_id,
    cs.created_by,
    cs.created_at,
    COUNT(DISTINCT sp.wallet_address) as participant_count,
    MAX(m.timestamp) as last_message_at
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
    MIN(m.timestamp) as first_message_at,
    MAX(m.timestamp) as last_message_at
FROM users u
LEFT JOIN messages m ON u.wallet_address = m.sender_address
GROUP BY u.wallet_address, u.display_name;

-- Sample data for testing (commented out by default)
/*
INSERT INTO users (wallet_address, display_name) VALUES
    ('11111111111111111111111111111111', 'Alice'),
    ('22222222222222222222222222222222', 'Bob');

INSERT INTO relay_servers (server_id, url, region, is_active) VALUES
    ('relay-1', 'ws://localhost:8080', 'us-west', true);
*/ 