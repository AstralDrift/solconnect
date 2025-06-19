# SolConnect Database Setup

This guide covers setting up PostgreSQL and the MCP Postgres server for SolConnect's message persistence and analytics features.

## Prerequisites

- macOS with Homebrew installed
- Node.js 16+ installed
- npm or yarn package manager

## PostgreSQL Setup

### 1. Install PostgreSQL (if not already installed)

```bash
# Install PostgreSQL via Homebrew
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Verify installation
postgres --version
```

### 2. Create Development Database

```bash
# Create the database
createdb solconnect_dev

# Verify database was created
psql -l | grep solconnect_dev
```

### 3. Apply Database Schema

```bash
# Apply the schema
psql -d solconnect_dev -f database/schema.sql

# Connect to database to verify
psql -d solconnect_dev

# List tables (in psql)
\dt

# Exit psql
\q
```

## MCP Postgres Server Setup

### 1. Install MCP Postgres Server

```bash
# Install globally
npm install -g @modelcontextprotocol/server-postgres

# Verify installation
npm list -g @modelcontextprotocol/server-postgres
```

### 2. Configuration

The MCP server is already configured in `.mcp.json`:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-postgres",
        "postgresql://localhost/solconnect_dev"
      ],
      "env": {
        "POSTGRES_CONNECTION_STRING": "${POSTGRES_CONNECTION_STRING}"
      },
      "description": "PostgreSQL integration for future message persistence and analytics"
    }
  }
}
```

### 3. Test Connection

Run the test script to verify everything is working:

```bash
# Install pg dependency
npm install pg

# Run test script
node test-postgres-connection.js

# Expected output:
# 🔄 Connecting to PostgreSQL...
# ✅ Connected successfully!
# 📅 Current timestamp: [current time]
# 📊 PostgreSQL version: PostgreSQL 14.x
# ✨ PostgreSQL is ready for SolConnect!
```

## Database Schema Overview

The database schema includes the following tables:

### Core Tables

- **users**: Stores wallet addresses and user metadata
- **chat_sessions**: Tracks chat sessions created by users
- **session_participants**: Maps users to chat sessions
- **messages**: Stores encrypted messages with signatures

### Supporting Tables

- **message_delivery**: Tracks delivery and read status
- **relay_servers**: Registry of available relay servers
- **message_metrics**: Analytics data for monitoring

### Views

- **active_sessions**: Shows currently active chat sessions
- **user_message_stats**: Aggregated user messaging statistics

## Using the Database Service

The `DatabaseService` class provides a TypeScript interface to the database:

```typescript
import { getDatabaseService } from '@/services/database/DatabaseService';

// Get singleton instance
const db = getDatabaseService();

// Connect to database
const connectResult = await db.connect();
if (!connectResult.success) {
  console.error('Failed to connect:', connectResult.error);
}

// Create or update user
const userResult = await db.createOrUpdateUser('wallet123', 'Alice');

// Save message
const messageResult = await db.saveMessage({
  messageId: 'msg123',
  sessionId: 'session123',
  senderAddress: 'wallet123',
  content: 'Encrypted content here',
  signature: 'signature123',
  timestamp: new Date()
});

// Get messages
const messagesResult = await db.getSessionMessages('session123', 50);
```

## Environment Variables

You can configure the database connection using environment variables:

```bash
# .env.local
DATABASE_URL=postgresql://localhost/solconnect_dev
```

## Production Considerations

1. **Connection Pooling**: The service uses pg Pool with sensible defaults
2. **Indexes**: All necessary indexes are created for performance
3. **Transactions**: Critical operations use transactions for consistency
4. **Error Handling**: All methods return Result<T> for proper error handling

## Troubleshooting

### PostgreSQL won't start

```bash
# Check if another PostgreSQL is running
brew services list | grep postgresql

# Stop all PostgreSQL services
brew services stop --all

# Start specific version
brew services start postgresql@14
```

### Permission denied errors

```bash
# Reset database ownership
createdb -O $(whoami) solconnect_dev
```

### MCP server connection issues

```bash
# Test direct connection
psql postgresql://localhost/solconnect_dev -c "SELECT 1"

# Check MCP server logs
npx @modelcontextprotocol/server-postgres postgresql://localhost/solconnect_dev
```

## Maintenance

### Backup Database

```bash
# Backup
pg_dump solconnect_dev > backup_$(date +%Y%m%d).sql

# Restore
psql solconnect_dev < backup_20240101.sql
```

### Clean Test Data

```sql
-- Connect to database
psql -d solconnect_dev

-- Clean all data (BE CAREFUL!)
TRUNCATE TABLE messages, message_delivery, session_participants, 
              chat_sessions, users, relay_servers, message_metrics 
              RESTART IDENTITY CASCADE;
```

## Next Steps

1. Integrate DatabaseService with SolConnectSDK for message persistence
2. Set up periodic metrics collection
3. Implement message history sync
4. Add database migrations system 