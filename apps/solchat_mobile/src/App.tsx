import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

// Mock types for Solana Mobile Wallet Adapter (stubs)
interface WalletAdapter {
  connect(): Promise<{ publicKey: string }>;
  disconnect(): Promise<void>;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

interface ChatConversation {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: number;
}

// TODO: Replace with actual Solana Mobile Wallet Adapter
const mockWalletAdapter: WalletAdapter = {
  async connect() {
    // Simulate wallet connection
    return { publicKey: 'So11111111111111111111111111111111111111112' };
  },
  async disconnect() {
    // Simulate disconnection
  },
};

const App: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [currentScreen, setCurrentScreen] = useState<'login' | 'chatList' | 'chatThread'>('login');
  const [selectedChat, setSelectedChat] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  
  // Mock chat data - replace with actual relay integration
  const [conversations] = useState<ChatConversation[]>([
    {
      id: '1',
      name: 'alice.sol',
      lastMessage: 'Hey! How are the markets today?',
      timestamp: Date.now() - 3600000,
    },
    {
      id: '2', 
      name: 'bob.sol',
      lastMessage: 'Did you see the new NFT drop?',
      timestamp: Date.now() - 7200000,
    },
    {
      id: '3',
      name: 'charlie.sol',
      lastMessage: 'LFG! 🚀',
      timestamp: Date.now() - 10800000,
    },
  ]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'alice.sol',
      text: 'Hey! How are the markets today?',
      timestamp: Date.now() - 3600000,
    },
    {
      id: '2',
      sender: 'me',
      text: 'Looking bullish! SOL is pumping 📈',
      timestamp: Date.now() - 3000000,
    },
  ]);

  const handleWalletConnect = async () => {
    try {
      const result = await mockWalletAdapter.connect();
      setWalletAddress(result.publicKey);
      setIsConnected(true);
      setCurrentScreen('chatList');
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect wallet');
    }
  };

  const handleWalletDisconnect = async () => {
    try {
      await mockWalletAdapter.disconnect();
      setIsConnected(false);
      setWalletAddress('');
      setCurrentScreen('login');
    } catch (error) {
      Alert.alert('Disconnection Error', 'Failed to disconnect wallet');
    }
  };

  const handleSendMessage = () => {
    if (messageText.trim()) {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: 'me',
        text: messageText,
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, newMessage]);
      setMessageText('');
      
      // Echo message back after 1 second (simulate relay)
      setTimeout(() => {
        const echoMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: selectedChat,
          text: `Echo: ${messageText}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, echoMessage]);
      }, 1000);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const renderLoginScreen = () => (
    <View style={styles.container}>
      <Text style={styles.title}>SolConnect 🚀</Text>
      <Text style={styles.subtitle}>Wallet-native encrypted chat</Text>
      
      <View style={styles.loginBox}>
        <Text style={styles.loginText}>
          Connect your Solana wallet to start chatting securely with other wallet holders.
        </Text>
        
        <TouchableOpacity style={styles.connectButton} onPress={handleWalletConnect}>
          <Text style={styles.connectButtonText}>Connect Wallet</Text>
        </TouchableOpacity>
        
        <Text style={styles.helpText}>
          Your wallet address is your only identity - no usernames, no passwords, just pure crypto! 🔐
        </Text>
      </View>
    </View>
  );

  const renderChatList = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity onPress={handleWalletDisconnect}>
          <Text style={styles.walletAddress}>{shortenAddress(walletAddress)}</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() => {
              setSelectedChat(item.name);
              setCurrentScreen('chatThread');
            }}
          >
            <View style={styles.chatItemContent}>
              <Text style={styles.chatName}>{item.name}</Text>
              <Text style={styles.lastMessage}>{item.lastMessage}</Text>
            </View>
            <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const renderChatThread = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentScreen('chatList')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selectedChat}</Text>
        <View />
      </View>
      
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageContainer,
            item.sender === 'me' ? styles.myMessage : styles.theirMessage
          ]}>
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
          </View>
        )}
      />
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ExpoStatusBar style="auto" />
      
      {currentScreen === 'login' && renderLoginScreen()}
      {currentScreen === 'chatList' && renderChatList()}
      {currentScreen === 'chatThread' && renderChatThread()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 60,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    color: '#666',
  },
  loginBox: {
    margin: 20,
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    marginBottom: 24,
    lineHeight: 22,
  },
  connectButton: {
    backgroundColor: '#9945FF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  connectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  walletAddress: {
    fontSize: 14,
    color: '#9945FF',
    fontFamily: 'monospace',
  },
  backButton: {
    fontSize: 16,
    color: '#9945FF',
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  chatItemContent: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  messageContainer: {
    margin: 8,
    padding: 12,
    borderRadius: 8,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#9945FF',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#9945FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default App; 