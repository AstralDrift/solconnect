import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ThemedButton } from '../../../mobile/components/ThemedButton';
import { useBiometricAuth } from '../hooks/useBiometricAuth';
import SolChatSDK from '../native/SolChatSDK';

interface LoginScreenProps {
  onLogin: (walletAddress: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const ok = await useBiometricAuth();
      if (!ok) {
        setError('Biometric authentication failed');
        return;
      }
      const walletAddress = await SolChatSDK.walletLogin();
      onLogin(walletAddress);
    } catch (err) {
      setError('Failed to login with wallet. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to SolConnect</Text>
      <Text style={styles.subtitle}>Secure, encrypted messaging on Solana</Text>
      
      {isLoading ? (
        <ActivityIndicator color="#9945FF" />
      ) : (
        <ThemedButton title="Login with Wallet" onPress={handleLogin} />
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff4444',
    marginTop: 20,
    textAlign: 'center',
  },
}); 