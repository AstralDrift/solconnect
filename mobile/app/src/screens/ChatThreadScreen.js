import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Button, FlatList, StyleSheet
} from 'react-native';
import SolChatSDK from '../SolChatSDK';

export default function ChatThreadScreen({ route }) {
  const { wallet, peer, title } = route.params;
  const [session, setSession] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    (async () => {
      const s = await SolChatSDK.start_session(peer);
      setSession(s);
      const incoming = await SolChatSDK.poll_messages(s);
      setMsgs(incoming);
    })();
  }, [peer]);

  const send = async () => {
    if (!session || !draft.trim()) return;
    await SolChatSDK.send_encrypted_message(session, draft);
    const incoming = await SolChatSDK.poll_messages(session);
    setMsgs(incoming);
    setDraft('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{title}</Text>
      <FlatList
        data={msgs}
        keyExtractor={(_,i) => i.toString()}
        renderItem={({item}) => (
          <View style={styles.msg}>
            <Text style={styles.sender}>{item.sender_wallet}:</Text>
            <Text>{item.ciphertext}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
        />
        <Button title="Send" onPress={send} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,padding:20},
  header:{fontSize:18,marginBottom:10},
  msg:{marginVertical:5},
  sender:{fontWeight:'bold'},
  inputRow:{flexDirection:'row',alignItems:'center'},
  input:{flex:1,borderWidth:1,borderColor:'#ccc',borderRadius:4,padding:8,marginRight:10}
}); 