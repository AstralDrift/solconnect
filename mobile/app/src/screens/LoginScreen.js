import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import SolChatSDK from '../SolChatSDK';
import { PrimaryButton, usePushNotifications, authenticateBiometric } from '../../shared';

export default function LoginScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const token = usePushNotifications();

  const handleLogin = async () => {
    setLoading(true);
    const bioOk = await authenticateBiometric('Login to SolConnect');
    if (!bioOk) {
      setLoading(false);
      return;
    }
    const wallet = await SolChatSDK.wallet_login();
    setLoading(false);
    navigation.replace('Chats', { wallet });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SolConnect Demo</Text>
      {token && (
        <Text style={styles.token} numberOfLines={1}>Push Token: {token}</Text>
      )}
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <PrimaryButton title="Login with Wallet" onPress={handleLogin} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex:1,alignItems:'center',justifyContent:'center',padding:20},
  title: {fontSize:24,marginBottom:20},
  token: {fontSize:10,color:'#999',marginBottom:10},
});
