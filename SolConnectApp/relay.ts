import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';

interface ChatMessage {
  roomId: string;
  message: string;
  sender: string;
  timestamp: string;
}

interface Room {
  clients: Set<WebSocket>;
  lastActivity: Date;
}

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map<string, Room>();

// Bob's possible responses
const bobResponses = [
  "Hey there! How's it going?",
  "That's interesting! Tell me more.",
  "I'm doing great, thanks for asking!",
  "What do you think about the latest Solana updates?",
  "Have you tried any other blockchain projects?",
  "The weather's been nice lately, hasn't it?",
  "I'm really excited about web3 development!",
  "Did you see that new NFT collection?",
  "How's your day going?",
  "That's a great point!",
] as const;

function getRandomBobResponse(): string {
  return bobResponses[Math.floor(Math.random() * bobResponses.length)];
}

function simulateTypingDelay(): number {
  return Math.floor(Math.random() * 2000) + 1000;
}

function broadcastToRoom(roomId: string, message: ChatMessage, excludeSender?: WebSocket): void {
  const room = rooms.get(roomId);
  if (!room) return;

  room.clients.forEach((client) => {
    if (client !== excludeSender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

function handleBobResponse(roomId: string, originalMessage: ChatMessage): void {
  setTimeout(() => {
    const bobResponse: ChatMessage = {
      roomId,
      message: getRandomBobResponse(),
      sender: 'bob.sol',
      timestamp: new Date().toISOString(),
    };
    
    broadcastToRoom(roomId, bobResponse);
  }, simulateTypingDelay());
}

wss.on('connection', (ws: WebSocket) => {
  let currentRoom: string | null = null;

  ws.on('message', async (rawMessage: Buffer) => {
    try {
      const data = JSON.parse(rawMessage.toString()) as ChatMessage;
      
      // Validate message structure
      if (!data.roomId || !data.message || !data.sender || !data.timestamp) {
        throw new Error('Invalid message format');
      }

      currentRoom = data.roomId;
      
      // Initialize room if it doesn't exist
      if (!rooms.has(data.roomId)) {
        rooms.set(data.roomId, {
          clients: new Set(),
          lastActivity: new Date(),
        });
      }

      const room = rooms.get(data.roomId)!;
      room.clients.add(ws);
      room.lastActivity = new Date();

      // Broadcast message to room
      broadcastToRoom(data.roomId, data, ws);

      console.log(`[Relay] Message in room ${data.roomId}: ${data.message.substring(0, 20)}...`);

      // Handle Bob's responses
      if (data.roomId.includes('bob.sol')) {
        handleBobResponse(data.roomId, data);
      }
    } catch (err) {
      console.error('[Relay] Error handling message:', err);
      ws.send(JSON.stringify({
        error: 'Failed to process message',
        details: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom)!;
      room.clients.delete(ws);
      
      // Clean up empty rooms
      if (room.clients.size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });

  ws.on('error', (err: Error) => {
    console.error('[Relay] WebSocket error:', err);
  });
});

// Cleanup inactive rooms every hour
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [roomId, room] of rooms.entries()) {
    if (room.lastActivity < oneHourAgo) {
      rooms.delete(roomId);
    }
  }
}, 60 * 60 * 1000);

console.log('Relay running on ws://localhost:8080/'); 