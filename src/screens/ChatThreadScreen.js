import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, TextInput, Button, StyleSheet} from 'react-native';
import SolChatSDK from '../SolChatSDK';

export default function ChatThreadScreen({route}) {
  const {wallet, peer, title} = route.params;
  const [session, setSession] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    (async () => {
      const s = await SolChatSDK.start_session(peer);
      setSession(s);
      setMsgs(await SolChatSDK.poll_messages(s));
    })();
  }, [peer]);

  const send = async () => {
    if (!draft.trim()) return;
    await SolChatSDK.send_encrypted_message(session, draft);
    setMsgs(await SolChatSDK.poll_messages(session));
    setDraft('');
  };

  return (
    <View style={s.c}>
      <Text style={s.h}>{title}</Text>
      <FlatList 
        data={msgs} 
        keyExtractor={(_, i) => i.toString()}
        renderItem={({item}) => (
          <View style={s.m}>
            <Text style={s.b}>{item.sender_wallet}:</Text>
            <Text>{item.ciphertext}</Text>
          </View>
        )}
      />
      <View style={s.row}>
        <TextInput 
          style={s.in} 
          value={draft} 
          onChangeText={setDraft} 
          placeholder="Type…"
        />
        <Button title="Send" onPress={send}/>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  c: {flex: 1, padding: 20},
  h: {fontSize: 18, marginBottom: 10},
  m: {marginVertical: 4},
  b: {fontWeight: 'bold'},
  row: {flexDirection: 'row', alignItems: 'center'},
  in: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginRight: 8
  }
}); 