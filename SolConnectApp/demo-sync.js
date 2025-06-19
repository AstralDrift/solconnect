#!/usr/bin/env node

/**
 * Demo script for SolConnect Sync Protocol
 * Demonstrates multi-device message synchronization
 */

import WebSocket from 'ws';

// Configuration
const RELAY_URL = 'ws://localhost:8080';
const SESSION_ID = 'demo-sync-session-123';

// Device simulation
class SimulatedDevice {
  constructor(deviceId, userName) {
    this.deviceId = deviceId;
    this.userName = userName;
    this.ws = null;
    this.messages = [];
    this.sequenceNumber = 0;
    this.vectorClock = { [deviceId]: 0 };
    this.isOnline = false;
  }

  async connect() {
    console.log(`\n[${this.deviceId}] Connecting...`);
    this.ws = new WebSocket(RELAY_URL);

    return new Promise((resolve, reject) => {
      this.ws.on('open', () => {
        console.log(`[${this.deviceId}] Connected`);
        this.isOnline = true;
        this.announceDevice();
        resolve();
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data);
        this.handleMessage(message);
      });

      this.ws.on('error', (error) => {
        console.error(`[${this.deviceId}] Error:`, error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log(`[${this.deviceId}] Disconnected`);
        this.isOnline = false;
      });
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Announce device to sync protocol
  announceDevice() {
    const announcement = {
      type: 'device_announce',
      sessionId: SESSION_ID,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      messageId: `announce-${Date.now()}`,
      deviceInfo: {
        platform: 'demo',
        version: '1.0.0',
        lastSeenAt: Date.now()
      },
      syncState: {
        lastSyncedSequence: this.sequenceNumber,
        vectorClock: this.vectorClock
      }
    };

    this.send(announcement);
  }

  // Send a chat message
  sendMessage(text) {
    if (!this.isOnline) {
      console.log(`[${this.deviceId}] Queueing message (offline): "${text}"`);
      this.messages.push({
        text,
        status: 'queued',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Increment vector clock
    this.vectorClock[this.deviceId] = (this.vectorClock[this.deviceId] || 0) + 1;

    const message = {
      roomId: SESSION_ID,
      message: text,
      sender: this.userName,
      timestamp: new Date().toISOString(),
      messageId: `msg-${Date.now()}`,
      vectorClock: this.vectorClock
    };

    console.log(`[${this.deviceId}] Sending: "${text}"`);
    this.send(message);
    this.messages.push({
      ...message,
      status: 'sent'
    });
  }

  // Request sync from server
  requestSync() {
    console.log(`[${this.deviceId}] Requesting sync...`);
    
    const syncRequest = {
      type: 'sync_request',
      sessionId: SESSION_ID,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      messageId: `sync-req-${Date.now()}`,
      lastSyncedSequence: this.sequenceNumber,
      syncVector: this.vectorClock
    };

    this.send(syncRequest);
  }

  // Send queued messages
  sendQueuedMessages() {
    const queued = this.messages.filter(m => m.status === 'queued');
    if (queued.length === 0) return;

    console.log(`[${this.deviceId}] Sending ${queued.length} queued messages...`);

    const messages = queued.map(msg => {
      this.vectorClock[this.deviceId] = (this.vectorClock[this.deviceId] || 0) + 1;
      return {
        message: {
          sender_wallet: this.userName,
          ciphertext: msg.text,
          timestamp: msg.timestamp,
          session_id: SESSION_ID
        },
        sequenceNumber: ++this.sequenceNumber,
        vectorClock: { ...this.vectorClock },
        localTimestamp: Date.now()
      };
    });

    const syncUpdate = {
      type: 'sync_update',
      sessionId: SESSION_ID,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      messageId: `sync-upd-${Date.now()}`,
      messages
    };

    this.send(syncUpdate);

    // Mark as pending
    queued.forEach(msg => msg.status = 'pending');
  }

  // Handle incoming messages
  handleMessage(message) {
    switch (message.type) {
      case 'sync_response':
        this.handleSyncResponse(message);
        break;
      case 'sync_ack':
        this.handleSyncAck(message);
        break;
      case 'sync_status':
        console.log(`[${this.deviceId}] Sync status:`, message.status, message.progress);
        break;
      case 'device_list':
        console.log(`[${this.deviceId}] Active devices:`, 
          message.devices.map(d => `${d.deviceId} (${d.platform})`).join(', '));
        break;
      default:
        // Regular message
        if (message.sender && message.sender !== this.userName) {
          console.log(`[${this.deviceId}] Received: "${message.message}" from ${message.sender}`);
          this.messages.push({
            ...message,
            status: 'received'
          });
          
          // Update vector clock
          if (message.vectorClock) {
            this.mergeVectorClock(message.vectorClock);
          }
          
          // Update sequence number
          if (message.sequenceNumber && message.sequenceNumber > this.sequenceNumber) {
            this.sequenceNumber = message.sequenceNumber;
          }
        }
    }
  }

  handleSyncResponse(response) {
    console.log(`[${this.deviceId}] Received ${response.messages.length} missing messages`);
    
    response.messages.forEach(msgData => {
      const exists = this.messages.some(m => 
        m.timestamp === msgData.message.timestamp && 
        m.sender === msgData.message.sender_wallet
      );
      
      if (!exists) {
        console.log(`[${this.deviceId}] Synced message: "${msgData.message.ciphertext}" from ${msgData.message.sender_wallet}`);
        this.messages.push({
          ...msgData.message,
          status: 'synced',
          sequenceNumber: msgData.sequenceNumber
        });
      }
    });
    
    // Update vector clock
    if (response.serverVectorClock) {
      this.mergeVectorClock(response.serverVectorClock);
    }
    
    // Update sequence number
    this.sequenceNumber = response.latestSequence;
  }

  handleSyncAck(ack) {
    console.log(`[${this.deviceId}] Messages acknowledged:`, ack.acknowledgedMessageIds.length);
    
    // Mark acknowledged messages as sent
    this.messages.forEach(msg => {
      if (msg.status === 'pending') {
        msg.status = 'sent';
      }
    });
    
    // Update vector clock
    if (ack.vectorClock) {
      this.mergeVectorClock(ack.vectorClock);
    }
  }

  mergeVectorClock(remoteClock) {
    Object.entries(remoteClock).forEach(([deviceId, value]) => {
      this.vectorClock[deviceId] = Math.max(this.vectorClock[deviceId] || 0, value);
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  printStatus() {
    console.log(`\n[${this.deviceId}] Status:`);
    console.log(`  - Online: ${this.isOnline}`);
    console.log(`  - Messages: ${this.messages.length}`);
    console.log(`  - Sequence: ${this.sequenceNumber}`);
    console.log(`  - Vector Clock:`, this.vectorClock);
    console.log(`  - Queued: ${this.messages.filter(m => m.status === 'queued').length}`);
  }
}

// Demo scenario
async function runDemo() {
  console.log('=== SolConnect Sync Protocol Demo ===\n');
  console.log('This demo simulates multi-device message synchronization');
  console.log('with offline support and conflict resolution.\n');

  // Create devices
  const device1 = new SimulatedDevice('device-1', 'Alice');
  const device2 = new SimulatedDevice('device-2', 'Bob');
  const device3 = new SimulatedDevice('device-3', 'Charlie');

  try {
    // Scenario 1: All devices online
    console.log('\n--- Scenario 1: All devices online ---');
    await device1.connect();
    await device2.connect();
    await device3.connect();

    await sleep(1000);

    // Send messages
    device1.sendMessage('Hello from Alice!');
    await sleep(500);
    device2.sendMessage('Hi Alice, this is Bob!');
    await sleep(500);
    device3.sendMessage('Hey everyone, Charlie here!');

    await sleep(2000);

    // Scenario 2: Device goes offline and sends messages
    console.log('\n--- Scenario 2: Device 2 goes offline ---');
    device2.disconnect();
    await sleep(500);

    device1.sendMessage('Bob, are you there?');
    device2.sendMessage('I am offline but still sending...');
    device2.sendMessage('These messages will be queued');
    device3.sendMessage('I think Bob disconnected');

    await sleep(2000);

    // Scenario 3: Device reconnects and syncs
    console.log('\n--- Scenario 3: Device 2 reconnects and syncs ---');
    await device2.connect();
    await sleep(500);
    
    device2.sendQueuedMessages();
    await sleep(1000);
    device2.requestSync();

    await sleep(2000);

    // Scenario 4: New device joins and syncs history
    console.log('\n--- Scenario 4: New device joins and syncs ---');
    const device4 = new SimulatedDevice('device-4', 'David');
    await device4.connect();
    await sleep(500);
    
    device4.requestSync();
    await sleep(1000);
    device4.sendMessage('Just joined! Got all the history!');

    await sleep(2000);

    // Print final status
    console.log('\n--- Final Status ---');
    device1.printStatus();
    device2.printStatus();
    device3.printStatus();
    device4.printStatus();

    // Cleanup
    await sleep(2000);
    device1.disconnect();
    device2.disconnect();
    device3.disconnect();
    device4.disconnect();

  } catch (error) {
    console.error('Demo error:', error);
  }

  console.log('\n=== Demo Complete ===');
  process.exit(0);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if relay server is running
async function checkRelay() {
  try {
    const ws = new WebSocket(RELAY_URL);
    return new Promise((resolve) => {
      ws.on('open', () => {
        ws.close();
        resolve(true);
      });
      ws.on('error', () => {
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

// Run the demo
(async () => {
  const relayRunning = await checkRelay();
  if (!relayRunning) {
    console.error('Error: Relay server is not running!');
    console.error('Please start the relay server first:');
    console.error('  node relay-sync.js');
    process.exit(1);
  }

  await runDemo();
})(); 