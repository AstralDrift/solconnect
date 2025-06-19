import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatThreadScreen from './src/screens/ChatThreadScreen';
import MonitoringScreen from './src/screens/MonitoringScreen';
import { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App(): JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f4511e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Login" 
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Chats" 
          component={ChatListScreen}
          options={{ title: 'Your Chats' }}
        />
        <Stack.Screen 
          name="Thread" 
          component={ChatThreadScreen}
          options={({ route }) => ({ 
            title: route.params.peerName || 'Chat'
          })}
        />
        <Stack.Screen 
          name="Monitoring" 
          component={MonitoringScreen}
          options={{ title: 'System Monitoring' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
} 