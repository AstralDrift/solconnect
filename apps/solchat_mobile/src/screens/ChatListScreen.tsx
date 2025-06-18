import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { Session } from '../native/SolChatSDK';

interface ChatListScreenProps {
  walletAddress: string;
  onSelectChat: (session: Session) => void;
}

// Mock data for development
const MOCK_CHATS = [
  { peerWallet: 'Peer1Wallet123', sessionId: 'session_1' },
  { peerWallet: 'Peer2Wallet456', sessionId: 'session_2' },
];

export const ChatListScreen: React.FC<ChatListScreenProps> = ({
  walletAddress,
  onSelectChat,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [chats, setChats] = useState<Session[]>([]);

  useEffect(() => {
    // In a real app, we would fetch the chat list from the SDK
    // For now, use mock data
    setTimeout(() => {
      setChats(MOCK_CHATS);
      setIsLoading(false);
    }, 1000);
  }, []);

  const renderChatItem = ({ item }: { item: Session }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => onSelectChat(item)}
    >
      <View style={styles.chatInfo}>
        <Text style={styles.peerWallet}>{item.peerWallet}</Text>
        <Text style={styles.sessionId}>Session: {item.sessionId}</Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9945FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Chats</Text>
        <Text style={styles.walletAddress}>
          Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </Text>
      </View>

      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No messages... yet. Did your wallet lose its tongue? 😉
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.sessionId}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  walletAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  list: {
    padding: 10,
  },
  chatItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chatInfo: {
    flex: 1,
  },
  peerWallet: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sessionId: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 