import { NativeModules, Platform } from 'react-native';

// If we're in development, use a mock implementation
const isDev = __DEV__;

interface Session {
  peerWallet: string;
  sessionId: string;
}

interface EncryptedMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

interface SolChatSDKInterface {
  walletLogin(): Promise<string>;
  startSession(peerWallet: string): Promise<Session>;
  sendEncryptedMessage(session: Session, plaintext: string): Promise<void>;
  pollMessages(session: Session): Promise<EncryptedMessage[]>;
}

// Mock implementation for development
const mockSDK: SolChatSDKInterface = {
  walletLogin: async () => {
    console.log('Mock: Wallet login');
    return 'MockWallet123456789';
  },
  startSession: async (peerWallet: string) => {
    console.log('Mock: Starting session with', peerWallet);
    return {
      peerWallet,
      sessionId: `mock_session_${Date.now()}`,
    };
  },
  sendEncryptedMessage: async (session: Session, plaintext: string) => {
    console.log('Mock: Sending message to', session.peerWallet, ':', plaintext);
  },
  pollMessages: async (session: Session) => {
    console.log('Mock: Polling messages for', session.peerWallet);
    return [
      {
        sender: session.peerWallet,
        content: 'Hello from the mock side!',
        timestamp: Date.now(),
      },
    ];
  },
  sendProtocolMessage: async (message: Uint8Array) => {
    console.log('Mock: Sending protocol message:', message);
  },
};

// Get the native module or use mock
const SolChatSDK = Platform.select({
  native: isDev ? mockSDK : NativeModules.SolChatSDK,
  default: mockSDK,
}) as SolChatSDKInterface;

export default SolChatSDK;
export type { Session, EncryptedMessage }; 