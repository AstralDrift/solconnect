import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';

const demoThreads = [
  { id: 'alice.sol', name: 'Chat with Alice' },
  { id: 'bob.sol',   name: 'Chat with Bob' },
];

export default function ChatListScreen({ route, navigation }) {
  const { wallet } = route.params;
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Logged in as {wallet}</Text>
      <FlatList
        data={demoThreads}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
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

const styles = StyleSheet.create({
  container:{flex:1,padding:20},
  header:{fontSize:18,marginBottom:10},
  item:{padding:15,borderBottomWidth:1,borderColor:'#ddd'}
}); 