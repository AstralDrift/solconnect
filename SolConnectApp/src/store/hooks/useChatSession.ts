import { useEffect, useCallback } from 'react';
import { useAuth } from '../slices/auth';
import { useRooms } from '../slices/rooms';
import { useMessages } from '../slices/messages';
import SolChatSDK from '../../SolChatSDK';

export function useChatSession(roomId: string) {
  const { wallet } = useAuth();
  const { rooms, updateRoom } = useRooms();
  const { messages, addMessage, addMessages, setError } = useMessages();

  const room = rooms.find((r) => r.id === roomId);
  const session = room?.session;

  const startSession = useCallback(async () => {
    if (!wallet || !room) return;

    try {
      const newSession = await SolChatSDK.start_session(room.id);
      updateRoom(roomId, { session: newSession });

      // Poll for initial messages
      const initialMessages = await SolChatSDK.poll_messages(newSession);
      if (initialMessages.length > 0) {
        addMessages(roomId, initialMessages);
      }
    } catch (err) {
      console.error('[useChatSession] Error starting session:', err);
      setError('Failed to start chat session');
    }
  }, [wallet, room, roomId, updateRoom, addMessages, setError]);

  const sendMessage = useCallback(async (text: string) => {
    if (!session) {
      await startSession();
      return;
    }

    try {
      // Add message to local state immediately
      const newMessage = {
        sender_wallet: wallet!,
        ciphertext: text,
        timestamp: new Date().toISOString(),
      };
      addMessage(roomId, newMessage);

      // Send encrypted message
      await SolChatSDK.send_encrypted_message(session, text);

      // Poll for replies
      const replies = await SolChatSDK.poll_messages(session);
      if (replies.length > 0) {
        addMessages(roomId, replies);
      }
    } catch (err) {
      console.error('[useChatSession] Error sending message:', err);
      setError('Failed to send message');
    }
  }, [session, wallet, roomId, addMessage, addMessages, setError, startSession]);

  // Handle reconnection
  useEffect(() => {
    if (!session && wallet && room) {
      startSession();
    }
  }, [session, wallet, room, startSession]);

  return {
    session,
    messages: messages[roomId] || [],
    sendMessage,
    startSession,
  };
} 