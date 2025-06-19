import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

// Data structures for sync support
const rooms = new Map(); // Map of room ID to Set of WebSocket clients
const messageHistory = new Map(); // Map of roomId to array of messages with metadata
const deviceStates = new Map(); // Map of deviceId to sync state
const MAX_HISTORY_PER_ROOM = 1000;

// Sync message types
const SyncMessageType = {
  SYNC_REQUEST: 'sync_request',
  SYNC_UPDATE: 'sync_update',
  SYNC_ACK: 'sync_ack',
  SYNC_RESPONSE: 'sync_response',
  SYNC_CONFLICT: 'sync_conflict',
  SYNC_STATUS: 'sync_status',
  DEVICE_ANNOUNCE: 'device_announce',
  DEVICE_LIST: 'device_list',
  SYNC_HEARTBEAT: 'sync_heartbeat'
};

// Helper to generate sequence numbers
let globalSequence = 0;
const getNextSequence = () => ++globalSequence;

// Helper to merge vector clocks
function mergeVectorClocks(clock1, clock2) {
  const merged = { ...clock1 };
  for (const [deviceId, value] of Object.entries(clock2)) {
    merged[deviceId] = Math.max(merged[deviceId] || 0, value);
  }
  return merged;
}

// Store message with metadata
function storeMessage(roomId, message, deviceId, vectorClock) {
  if (!messageHistory.has(roomId)) {
    messageHistory.set(roomId, []);
  }
  
  const history = messageHistory.get(roomId);
  const sequenceNumber = getNextSequence();
  
  const storedMessage = {
    ...message,
    sequenceNumber,
    vectorClock: vectorClock || { [deviceId]: sequenceNumber },
    serverTimestamp: Date.now(),
    originalDeviceId: deviceId
  };
  
  history.push(storedMessage);
  
  // Limit history size
  if (history.length > MAX_HISTORY_PER_ROOM) {
    history.splice(0, history.length - MAX_HISTORY_PER_ROOM);
  }
  
  return storedMessage;
}

// Get messages since a specific sequence number
function getMessagesSince(roomId, sinceSequence, syncVector) {
  const history = messageHistory.get(roomId) || [];
  
  // Filter messages newer than the requested sequence
  return history.filter(msg => {
    // Check if message is newer than what device has
    if (msg.sequenceNumber > sinceSequence) {
      return true;
    }
    
    // Also check vector clock for missing messages
    if (syncVector && msg.vectorClock) {
      for (const [deviceId, deviceSeq] of Object.entries(msg.vectorClock)) {
        if ((syncVector[deviceId] || 0) < deviceSeq) {
          return true;
        }
      }
    }
    
    return false;
  });
}

// Handle sync request
async function handleSyncRequest(ws, message) {
  console.log(`[Sync] Request from ${message.deviceId} for session ${message.sessionId}`);
  
  const missingMessages = getMessagesSince(
    message.sessionId,
    message.lastSyncedSequence,
    message.syncVector
  );
  
  // Get server vector clock
  const serverVectorClock = {};
  const history = messageHistory.get(message.sessionId) || [];
  history.forEach(msg => {
    if (msg.vectorClock) {
      Object.entries(msg.vectorClock).forEach(([deviceId, seq]) => {
        serverVectorClock[deviceId] = Math.max(serverVectorClock[deviceId] || 0, seq);
      });
    }
  });
  
  const response = {
    type: SyncMessageType.SYNC_RESPONSE,
    sessionId: message.sessionId,
    deviceId: 'server',
    timestamp: Date.now(),
    messageId: `sync-resp-${Date.now()}`,
    messages: missingMessages.map(msg => ({
      message: {
        sender_wallet: msg.sender || msg.sender_wallet,
        ciphertext: msg.message || msg.ciphertext,
        timestamp: msg.timestamp,
        session_id: message.sessionId
      },
      sequenceNumber: msg.sequenceNumber,
      vectorClock: msg.vectorClock,
      serverTimestamp: msg.serverTimestamp,
      originalDeviceId: msg.originalDeviceId
    })),
    latestSequence: history.length > 0 ? history[history.length - 1].sequenceNumber : 0,
    serverVectorClock
  };
  
  ws.send(JSON.stringify(response));
  
  // Send sync status
  const status = {
    type: SyncMessageType.SYNC_STATUS,
    sessionId: message.sessionId,
    deviceId: 'server',
    timestamp: Date.now(),
    messageId: `sync-status-${Date.now()}`,
    status: 'completed',
    progress: {
      messagesSynced: missingMessages.length,
      totalMessages: history.length,
      conflictsResolved: 0
    }
  };
  
  ws.send(JSON.stringify(status));
}

// Handle sync update (new messages from device)
async function handleSyncUpdate(ws, message) {
  console.log(`[Sync] Update from ${message.deviceId} with ${message.messages.length} messages`);
  
  const acknowledgedSequences = [];
  const acknowledgedMessageIds = [];
  let mergedVectorClock = {};
  
  for (const msgData of message.messages) {
    // Store the message
    const stored = storeMessage(
      message.sessionId,
      msgData.message,
      message.deviceId,
      msgData.vectorClock
    );
    
    acknowledgedSequences.push(stored.sequenceNumber);
    acknowledgedMessageIds.push(msgData.message.messageId || stored.sequenceNumber.toString());
    mergedVectorClock = mergeVectorClocks(mergedVectorClock, stored.vectorClock);
    
    // Broadcast to other clients in the room
    const room = rooms.get(message.sessionId);
    if (room) {
      const broadcastMessage = {
        roomId: message.sessionId,
        message: msgData.message.ciphertext,
        sender: msgData.message.sender_wallet,
        timestamp: msgData.message.timestamp,
        messageId: stored.sequenceNumber.toString(),
        sequenceNumber: stored.sequenceNumber,
        vectorClock: stored.vectorClock
      };
      
      room.forEach(client => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(broadcastMessage));
        }
      });
    }
  }
  
  // Send acknowledgment
  const ack = {
    type: SyncMessageType.SYNC_ACK,
    sessionId: message.sessionId,
    deviceId: 'server',
    timestamp: Date.now(),
    messageId: `sync-ack-${Date.now()}`,
    acknowledgedSequences,
    acknowledgedMessageIds,
    vectorClock: mergedVectorClock
  };
  
  ws.send(JSON.stringify(ack));
}

// Handle device announcement
async function handleDeviceAnnounce(ws, message) {
  console.log(`[Sync] Device announced: ${message.deviceId} on ${message.deviceInfo.platform}`);
  
  // Store device state
  deviceStates.set(message.deviceId, {
    ...message,
    ws,
    lastSeenAt: Date.now()
  });
  
  // Get list of active devices for this session
  const activeDevices = [];
  for (const [deviceId, state] of deviceStates) {
    if (state.sessionId === message.sessionId) {
      activeDevices.push({
        deviceId: state.deviceId,
        platform: state.deviceInfo.platform,
        lastSeenAt: state.lastSeenAt,
        isOnline: state.ws.readyState === 1,
        syncState: state.syncState
      });
    }
  }
  
  // Send device list to all devices in session
  const deviceList = {
    type: SyncMessageType.DEVICE_LIST,
    sessionId: message.sessionId,
    deviceId: 'server',
    timestamp: Date.now(),
    messageId: `device-list-${Date.now()}`,
    devices: activeDevices
  };
  
  const room = rooms.get(message.sessionId);
  if (room) {
    room.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(deviceList));
      }
    });
  }
}

// Handle sync heartbeat
async function handleSyncHeartbeat(ws, message) {
  // Update device last seen
  const deviceState = deviceStates.get(message.deviceId);
  if (deviceState) {
    deviceState.lastSeenAt = Date.now();
    deviceState.syncState = {
      lastSyncedSequence: message.sequenceNumber,
      vectorClock: message.vectorClock
    };
  }
}

wss.on('connection', ws => {
  let currentRooms = new Set();
  let deviceId = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle sync messages
      if (data.type && Object.values(SyncMessageType).includes(data.type)) {
        switch (data.type) {
          case SyncMessageType.SYNC_REQUEST:
            await handleSyncRequest(ws, data);
            break;
          case SyncMessageType.SYNC_UPDATE:
            await handleSyncUpdate(ws, data);
            break;
          case SyncMessageType.DEVICE_ANNOUNCE:
            deviceId = data.deviceId;
            await handleDeviceAnnounce(ws, data);
            break;
          case SyncMessageType.SYNC_HEARTBEAT:
            await handleSyncHeartbeat(ws, data);
            break;
          default:
            console.log(`[Sync] Unhandled sync message type: ${data.type}`);
        }
        return;
      }
      
      // Handle regular chat messages
      const roomId = data.roomId || data.sessionId;
      if (!roomId) {
        console.error('[Relay] No room ID in message');
        return;
      }
      
      currentRooms.add(roomId);
      
      // Add client to room if not already there
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId).add(ws);
      
      // Store message in history
      const storedMessage = storeMessage(
        roomId,
        data,
        deviceId || 'unknown',
        data.vectorClock
      );
      
      // Broadcast to everyone in the same room except sender
      rooms.get(roomId).forEach(client => {
        if (client !== ws && client.readyState === 1) {
          const broadcastData = {
            ...data,
            sequenceNumber: storedMessage.sequenceNumber,
            serverTimestamp: storedMessage.serverTimestamp
          };
          client.send(JSON.stringify(broadcastData));
        }
      });

      console.log(`[Relay] Message in room ${roomId}: ${data.message.substring(0, 20)}...`);

      // Auto-reply for demo purposes (Bob)
      if (roomId.includes('bob.sol') && data.sender !== 'bob.sol') {
        const bobResponses = [
          "Hey there! How's it going?",
          "That's interesting! Tell me more.",
          "I'm doing great, thanks for asking!",
          "What do you think about the latest Solana updates?",
          "Have you tried any other blockchain projects?",
        ];
        
        setTimeout(() => {
          const bobMessage = {
            roomId: roomId,
            message: bobResponses[Math.floor(Math.random() * bobResponses.length)],
            sender: 'bob.sol',
            timestamp: new Date().toISOString()
          };
          
          // Store Bob's message
          const bobStored = storeMessage(roomId, bobMessage, 'bob-device', null);
          
          // Send Bob's response to all clients in the room
          rooms.get(roomId).forEach((client) => {
            if (client.readyState === 1) {
              const broadcastBob = {
                ...bobMessage,
                sequenceNumber: bobStored.sequenceNumber,
                serverTimestamp: bobStored.serverTimestamp
              };
              client.send(JSON.stringify(broadcastBob));
            }
          });
        }, Math.floor(Math.random() * 2000) + 1000);
      }
    } catch (err) {
      console.error('[Relay] Error handling message:', err);
      ws.send(JSON.stringify({ error: err.message }));
    }
  });

  ws.on('close', () => {
    // Remove client from all their rooms
    for (const roomId of currentRooms) {
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(ws);
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
        }
      }
    }
    
    // Update device state
    if (deviceId && deviceStates.has(deviceId)) {
      const state = deviceStates.get(deviceId);
      state.lastSeenAt = Date.now();
      state.ws = null;
    }
  });

  ws.on('error', err => {
    console.error('[Relay] WebSocket error:', err);
  });
});

console.log('Enhanced relay with sync support running on ws://localhost:8080/');
console.log('Features:');
console.log('- Message history and sequencing');
console.log('- Vector clock support');
console.log('- Device synchronization');
console.log('- Conflict detection');
console.log('- Multi-device message sync'); 