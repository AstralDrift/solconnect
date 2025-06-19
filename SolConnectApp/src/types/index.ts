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

export interface Message {
  sender_wallet: string;
  ciphertext: string;
  timestamp?: string;
  session_id?: string;
  content_type?: string;
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