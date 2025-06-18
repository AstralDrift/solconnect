import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import SolChatSDK from '../SolChatSDK';

export default function LoginScreen({ navigation }) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const wallet = await SolChatSDK.wallet_login();
    setLoading(false);
    navigation.replace('Chats', { wallet });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SolConnect Demo</Text>
      {loading
        ? <ActivityIndicator size="large" />
        : <Button title="Login with Wallet" onPress={handleLogin} />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex:1,alignItems:'center',justifyContent:'center',padding:20},
  title: {fontSize:24,marginBottom:20},
}); 