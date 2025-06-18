import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map(); // Map of room ID to Set of WebSocket clients

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
];

function getRandomBobResponse() {
  return bobResponses[Math.floor(Math.random() * bobResponses.length)];
}

// Simulate Bob's typing delay (1-3 seconds)
function simulateTypingDelay() {
  return Math.floor(Math.random() * 2000) + 1000;
}

wss.on('connection', ws => {
  let currentRoom = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      currentRoom = data.roomId;
      
      // Add client to room if not already there
      if (!rooms.has(data.roomId)) {
        rooms.set(data.roomId, new Set());
      }
      rooms.get(data.roomId).add(ws);

      // Broadcast to everyone in the same room except sender
      rooms.get(data.roomId).forEach(client => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });

      console.log(`[Relay] Message in room ${data.roomId}: ${data.message.substring(0, 20)}...`);

      // If this is a message to Bob, have him reply
      if (data.roomId.includes('bob.sol')) {
        setTimeout(() => {
          const bobResponse = {
            roomId: data.roomId,
            message: getRandomBobResponse(),
            sender: 'bob.sol',
            timestamp: new Date().toISOString()
          };
          
          // Send Bob's response to all clients in the room
          rooms.get(data.roomId).forEach((client) => {
            if (client.readyState === 1) {
              client.send(JSON.stringify(bobResponse));
            }
          });
        }, simulateTypingDelay());
      }
    } catch (err) {
      console.error('[Relay] Error handling message:', err);
    }
  });

  ws.on('close', () => {
    // Remove client from their room when they disconnect
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
    }
  });

  ws.on('error', err => {
    console.error('[Relay] WebSocket error:', err);
  });
});

console.log('Relay running on ws://localhost:8080/'); 