import React from 'react';
import {View, Text, FlatList, TouchableOpacity, StyleSheet} from 'react-native';

const data = [
  {id: 'alice.sol', name: 'Chat with Alice'},
  {id: 'bob.sol', name: 'Chat with Bob'}
];

export default function ChatListScreen({route, navigation}) {
  const {wallet} = route.params;
  
  return (
    <View style={s.c}>
      <Text style={s.h}>Logged in as {wallet}</Text>
      <FlatList 
        data={data} 
        keyExtractor={i => i.id}
        renderItem={({item}) => (
          <TouchableOpacity 
            style={s.it} 
            onPress={() => navigation.navigate('Thread', {
              wallet,
              peer: item.id,
              title: item.name
            })}
          >
            <Text>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  c: {flex: 1, padding: 20},
  h: {fontSize: 18, marginBottom: 10},
  it: {padding: 16, borderBottomWidth: 1, borderColor: '#ddd'}
}); 