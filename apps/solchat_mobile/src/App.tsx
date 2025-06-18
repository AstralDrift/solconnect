import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { LoginScreen } from './screens/LoginScreen';
import { ChatListScreen } from './screens/ChatListScreen';
import { ChatThreadScreen } from './screens/ChatThreadScreen';
import type { Session } from './native/SolChatSDK';

type Screen = 'login' | 'chatList' | 'chatThread';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);

  const handleLogin = (address: string) => {
    setWalletAddress(address);
    setCurrentScreen('chatList');
  };

  const handleSelectChat = (session: Session) => {
    setCurrentSession(session);
    setCurrentScreen('chatThread');
  };

  const handleBackFromChat = () => {
    setCurrentSession(null);
    setCurrentScreen('chatList');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} />;
      case 'chatList':
        return (
          <ChatListScreen
            walletAddress={walletAddress!}
            onSelectChat={handleSelectChat}
          />
        );
      case 'chatThread':
        return (
          <ChatThreadScreen
            session={currentSession!}
            onBack={handleBackFromChat}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderScreen()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
}); 