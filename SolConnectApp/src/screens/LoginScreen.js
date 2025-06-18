import React, {useState} from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform} from 'react-native';
import {useRouter} from 'next/router';
import SolChatSDK from '../SolChatSDK';

export default function LoginScreen({navigation}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  
  const handleLogin = async () => {
    setBusy(true);
    try {
      const w = await SolChatSDK.wallet_login();
      if (Platform.OS === 'web') {
        router.push({
          pathname: '/chats',
          query: { wallet: JSON.stringify(w) }
        });
      } else {
        navigation.replace('Chats', {wallet: w});
      }
    } catch (error) {
      console.error('Login error:', error);
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>SolConnect Demo</Text>
      {busy ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : (
        <TouchableOpacity 
          style={styles.button}
          onPress={handleLogin}
        >
          <Text style={styles.buttonText}>Login with Wallet</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  heading: {
    fontSize: 24,
    marginBottom: 24,
    color: '#000',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 