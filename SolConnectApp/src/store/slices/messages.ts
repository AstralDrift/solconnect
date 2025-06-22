import { create } from 'zustand';
import { MessagesState, Message } from '../types';
import { MessageStatus, MessageStatusUpdate } from '../../types';

export const useMessages = create<MessagesState>()((set, get) => ({
  messages: {},
  optimisticUpdates: {},
  statusUpdateQueue: [],
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

  updateMessageStatus: (roomId, messageId, status, optimistic = false) => set((state) => {
    const roomMessages = state.messages[roomId] || [];
    const messageIndex = roomMessages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) return state;

    const updatedMessages = [...roomMessages];
    const message = { ...updatedMessages[messageIndex] };
    
    // Update message status
    message.status = status;
    
    // Update status timestamps
    if (!message.statusTimestamps) {
      message.statusTimestamps = {};
    }
    
    const timestamp = new Date().toISOString();
    switch (status) {
      case MessageStatus.SENT:
        message.statusTimestamps.sentAt = timestamp;
        break;
      case MessageStatus.DELIVERED:
        message.statusTimestamps.deliveredAt = timestamp;
        break;
      case MessageStatus.READ:
        message.statusTimestamps.readAt = timestamp;
        message.readAt = timestamp; // Legacy field
        break;
      case MessageStatus.FAILED:
        message.statusTimestamps.failedAt = timestamp;
        break;
    }
    
    updatedMessages[messageIndex] = message;
    
    const newState = {
      ...state,
      messages: {
        ...state.messages,
        [roomId]: updatedMessages
      }
    };

    // Handle optimistic updates
    if (optimistic) {
      newState.optimisticUpdates = {
        ...state.optimisticUpdates,
        [messageId]: status
      };
    } else {
      // Clear optimistic update when real update arrives
      const { [messageId]: _, ...remainingOptimistic } = state.optimisticUpdates;
      newState.optimisticUpdates = remainingOptimistic;
    }

    return newState;
  }),

  batchUpdateMessageStatus: (updates) => set((state) => {
    const newMessages = { ...state.messages };
    const newOptimistic = { ...state.optimisticUpdates };

    for (const update of updates) {
      // Find the message across all rooms
      for (const [roomId, roomMessages] of Object.entries(newMessages)) {
        const messageIndex = roomMessages.findIndex(m => m.id === update.messageId);
        if (messageIndex !== -1) {
          const updatedMessages = [...roomMessages];
          const message = { ...updatedMessages[messageIndex] };
          
          message.status = update.status;
          
          if (!message.statusTimestamps) {
            message.statusTimestamps = {};
          }
          
          switch (update.status) {
            case MessageStatus.SENT:
              message.statusTimestamps.sentAt = update.timestamp;
              break;
            case MessageStatus.DELIVERED:
              message.statusTimestamps.deliveredAt = update.timestamp;
              break;
            case MessageStatus.READ:
              message.statusTimestamps.readAt = update.timestamp;
              message.readAt = update.timestamp;
              break;
            case MessageStatus.FAILED:
              message.statusTimestamps.failedAt = update.timestamp;
              break;
          }
          
          updatedMessages[messageIndex] = message;
          newMessages[roomId] = updatedMessages;
          
          // Clear optimistic update
          delete newOptimistic[update.messageId];
          break;
        }
      }
    }

    return {
      ...state,
      messages: newMessages,
      optimisticUpdates: newOptimistic
    };
  }),

  clearOptimisticUpdate: (messageId) => set((state) => {
    const { [messageId]: _, ...remainingOptimistic } = state.optimisticUpdates;
    return {
      ...state,
      optimisticUpdates: remainingOptimistic
    };
  }),

  queueStatusUpdate: (update) => set((state) => ({
    ...state,
    statusUpdateQueue: [...state.statusUpdateQueue, update]
  })),

  processStatusUpdateQueue: () => {
    const { statusUpdateQueue, batchUpdateMessageStatus } = get();
    if (statusUpdateQueue.length > 0) {
      batchUpdateMessageStatus(statusUpdateQueue);
      set((state) => ({ ...state, statusUpdateQueue: [] }));
    }
  },

  getMessageStatus: (messageId) => {
    const state = get();
    
    // Check optimistic updates first
    if (state.optimisticUpdates[messageId]) {
      return state.optimisticUpdates[messageId];
    }
    
    // Search for message in all rooms
    for (const roomMessages of Object.values(state.messages)) {
      const message = roomMessages.find(m => m.id === messageId);
      if (message) {
        return message.status || MessageStatus.SENT;
      }
    }
    
    return null;
  },
  
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
})); 