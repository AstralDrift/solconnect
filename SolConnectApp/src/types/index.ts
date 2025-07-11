import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export interface Wallet {
  address: string;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface ChatSession {
  session_id: string;
  peer_wallet: string;
  sharedKey: Uint8Array;
}

export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export interface MessageStatusTimestamps {
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
}

export interface Message {
  id?: string;
  sender_wallet: string;
  ciphertext: string;
  timestamp?: string;
  session_id?: string;
  content_type?: string;
  status?: MessageStatus;
  statusTimestamps?: MessageStatusTimestamps;
  // Legacy fields for backward compatibility
  readAt?: string;
  deliveredAt?: string;
}

export interface MessageStatusUpdate {
  messageId: string;
  sessionId: string;
  status: MessageStatus;
  timestamp: string;
  userId: string;
  error?: string;
}

export interface StatusUpdateEvent {
  type: 'status_update';
  data: MessageStatusUpdate;
  encrypted: boolean;
}

export interface ReadReceipt {
  messageId: string;
  sessionId: string;
  readerWallet: string;
  status: 'delivered' | 'read';
  timestamp: string;
}

export type RootStackParamList = {
  Login: undefined;
  Chats: { wallet: string };
  Thread: { 
    session: ChatSession;
    peerName: string;
  };
  Monitoring: undefined;
};

export type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

export interface LoginScreenProps {
  navigation: NavigationProps;
}

export interface ChatListScreenProps {
  navigation: NavigationProps;
  route: {
    params: {
      wallet: string;
    };
  };
}

export interface ChatThreadScreenProps {
  navigation: NavigationProps;
  route: {
    params: {
      session: ChatSession;
      peerName: string;
    };
  };
} 