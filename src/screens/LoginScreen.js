import React, {useState} from 'react';
import {View, Text, Button, ActivityIndicator, StyleSheet} from 'react-native';
import SolChatSDK from '../SolChatSDK';

export default function LoginScreen({navigation}) {
  const [busy, setBusy] = useState(false);
  
  return (
    <View style={s.c}>
      <Text style={s.h}>SolConnect Demo</Text>
      {busy ? <ActivityIndicator size="large"/> :
        <Button 
          title="Login with Wallet" 
          onPress={async () => {
            setBusy(true);
            const w = await SolChatSDK.wallet_login();
            navigation.replace('Chats', {wallet: w});
          }}
        />
      }
    </View>
  );
}

const s = StyleSheet.create({
  c: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  h: {fontSize: 24, marginBottom: 24}
}); 