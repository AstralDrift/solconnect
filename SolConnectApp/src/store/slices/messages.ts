import { create } from 'zustand';
import { MessagesState, Message } from '../types';

export const useMessages = create<MessagesState>()((set) => ({
  messages: {},
  isLoading: false,
  error: null,
  setMessages: (roomId, messages) => set((state) => ({
    messages: { ...state.messages, [roomId]: messages },
    error: null,
  })),
  addMessage: (roomId, message) => set((state) => ({
    messages: {
      ...state.messages,
      [roomId]: [...(state.messages[roomId] || []), message],
    },
    error: null,
  })),
  addMessages: (roomId, newMessages) => set((state) => ({
    messages: {
      ...state.messages,
      [roomId]: [...(state.messages[roomId] || []), ...newMessages],
    },
    error: null,
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
})); 