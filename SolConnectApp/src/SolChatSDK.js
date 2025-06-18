import 'react-native-get-random-values';   // 💡 polyfill for crypto.getRandomValues
import nacl from 'tweetnacl';
import { encodeUTF8, decodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY = 'demoKeyPair';
let demoKeyPair = null;
let ws = null;
let messageCallback = null;

// Your computer's local IP address - replace this with your actual IP
const LOCAL_IP = '192.168.1.210'; // This should match the IP shown in your Expo QR code

export async function loadKeyPair() {
  if (demoKeyPair) return demoKeyPair;
  const stored = await AsyncStorage.getItem(KEY);
  if (stored) {
    const secret = Uint8Array.from(JSON.parse(stored));
    demoKeyPair = nacl.box.keyPair.fromSecretKey(secret);
  } else {
    demoKeyPair = nacl.box.keyPair();
    await AsyncStorage.setItem(KEY, JSON.stringify(Array.from(demoKeyPair.secretKey)));
  }
  return demoKeyPair;
}

function deriveSharedKey(theirPublicKey) {
  return nacl.box.before(theirPublicKey, demoKeyPair.secretKey);
}

function encryptMsg(sharedKey, plaintext) {
  const nonce = nacl.randomBytes(24);
  const boxed = nacl.box.after(decodeUTF8(plaintext), nonce, sharedKey);
  return encodeBase64(new Uint8Array([...nonce, ...boxed])); // nonce|ciphertext
}

function decryptMsg(sharedKey, ciphertext) {
  const data = decodeBase64(ciphertext);
  const nonce = data.slice(0, 24);
  const boxed = data.slice(24);
  const plaintext = nacl.box.open.after(boxed, nonce, sharedKey);
  return encodeUTF8(plaintext);
}

function connectWebSocket(room) {
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
    const { text } = JSON.parse(event.data);
    if (messageCallback) {
      messageCallback(text);
    }
  };

  ws.onerror = (error) => {
    console.error('[SDK] WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('[SDK] WebSocket closed');
  };
}

export default {
  wallet_login: async () => {
    await new Promise(r => setTimeout(r, 200));
    return 'solDemoWallet123';
  },

  start_session: async peer_wallet => {
    demoKeyPair = await loadKeyPair();
    const theirPublicKey = demoKeyPair.publicKey; // demo: same key for all
    const sharedKey = deriveSharedKey(theirPublicKey);
    const session_id = `${Date.now()}-${peer_wallet}`;
    
    // Connect to WebSocket with room ID
    connectWebSocket(session_id);
    
    return { session_id, peer_wallet, sharedKey };
  },

  send_encrypted_message: async ({ peer_wallet, sharedKey }, plaintext) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('[SDK] WebSocket not connected');
      return;
    }

    const myCipher = encryptMsg(sharedKey, plaintext);
    console.log('[SDK] sent ciphertext:', myCipher);

    // Send through WebSocket
    ws.send(JSON.stringify({
      room: `${Date.now()}-${peer_wallet}`,
      text: myCipher
    }));
  },

  poll_messages: async ({ peer_wallet, sharedKey }) => {
    return new Promise((resolve) => {
      messageCallback = (text) => {
        resolve([{
          sender_wallet: peer_wallet,
          ciphertext: decryptMsg(sharedKey, text)
        }]);
      };
    });
  },
}; 