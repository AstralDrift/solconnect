import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import { encodeUTF8, decodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ChatSession, Message } from './types';

const KEY = 'demoKeyPair';
let demoKeyPair: nacl.BoxKeyPair | null = null;
let ws: WebSocket | null = null;
let messageCallback: ((text: string) => void) | null = null;

// Your computer's local IP address - replace this with your actual IP
const LOCAL_IP = '192.168.1.210'; // This should match the IP shown in your Expo QR code

export async function loadKeyPair(): Promise<nacl.BoxKeyPair> {
  if (demoKeyPair) return demoKeyPair;
  
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored) {
      const secret = Uint8Array.from(JSON.parse(stored));
      demoKeyPair = nacl.box.keyPair.fromSecretKey(secret);
    } else {
      demoKeyPair = nacl.box.keyPair();
      await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(demoKeyPair.secretKey)));
    }
    return demoKeyPair;
  } catch (err) {
    console.error('[SDK] Error loading key pair:', err);
    throw new Error('Failed to load or create key pair');
  }
}

function deriveSharedKey(theirPublicKey: Uint8Array): Uint8Array {
  if (!demoKeyPair) throw new Error('Key pair not initialized');
  return nacl.box.before(theirPublicKey, demoKeyPair.secretKey);
}

function encryptMsg(sharedKey: Uint8Array, plaintext: string): string {
  const nonce = nacl.randomBytes(24);
  const boxed = nacl.box.after(decodeUTF8(plaintext), nonce, sharedKey);
  if (!boxed) throw new Error('Encryption failed');
  return encodeBase64(new Uint8Array([...nonce, ...boxed])); // nonce|ciphertext
}

function decryptMsg(sharedKey: Uint8Array, ciphertext: string): string {
  try {
    const data = decodeBase64(ciphertext);
    const nonce = data.slice(0, 24);
    const boxed = data.slice(24);
    const plaintext = nacl.box.open.after(boxed, nonce, sharedKey);
    if (!plaintext) throw new Error('Decryption failed');
    return encodeUTF8(plaintext);
  } catch (err) {
    console.error('[SDK] Decryption error:', err);
    throw new Error('Failed to decrypt message');
  }
}

function connectWebSocket(room: string): void {
  if (ws) {
    ws.close();
  }

  // Use local IP for mobile devices, localhost for web
  const wsUrl = Platform.OS === 'web' 
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8080`
    : `ws://${LOCAL_IP}:8080`;

  console.log('[SDK] Connecting to WebSocket:', wsUrl);
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('[SDK] WebSocket connected');
  };

  ws.onmessage = (event) => {
    try {
      const { text } = JSON.parse(event.data);
      if (messageCallback) {
        messageCallback(text);
      }
    } catch (err) {
      console.error('[SDK] Error parsing message:', err);
    }
  };

  ws.onerror = (error) => {
    console.error('[SDK] WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('[SDK] WebSocket closed');
  };
}

const SolChatSDK = {
  wallet_login: async (): Promise<string> => {
    await new Promise(r => setTimeout(r, 200));
    return 'solDemoWallet123';
  },

  start_session: async (peer_wallet: string): Promise<ChatSession> => {
    try {
      demoKeyPair = await loadKeyPair();
      const theirPublicKey = demoKeyPair.publicKey; // demo: same key for all
      const sharedKey = deriveSharedKey(theirPublicKey);
      const session_id = `${Date.now()}-${peer_wallet}`;
      
      // Connect to WebSocket with room ID
      connectWebSocket(session_id);
      
      return { session_id, peer_wallet, sharedKey };
    } catch (err) {
      console.error('[SDK] Error starting session:', err);
      throw new Error('Failed to start chat session');
    }
  },

  send_encrypted_message: async (session: ChatSession, plaintext: string): Promise<void> => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    try {
      const myCipher = encryptMsg(session.sharedKey, plaintext);
      console.log('[SDK] sent ciphertext:', myCipher);

      // Send through WebSocket
      ws.send(JSON.stringify({
        room: session.session_id,
        text: myCipher
      }));
    } catch (err) {
      console.error('[SDK] Error sending message:', err);
      throw new Error('Failed to send encrypted message');
    }
  },

  poll_messages: async (session: ChatSession): Promise<Message[]> => {
    return new Promise((resolve) => {
      messageCallback = (text: string) => {
        try {
          const decrypted = decryptMsg(session.sharedKey, text);
          resolve([{
            sender_wallet: session.peer_wallet,
            ciphertext: decrypted,
            timestamp: new Date().toISOString()
          }]);
        } catch (err) {
          console.error('[SDK] Error polling messages:', err);
          resolve([]);
        }
      };
    });
  },
};

export default SolChatSDK; 