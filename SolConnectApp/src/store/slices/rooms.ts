import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RoomsState, Room } from '../types';

export const useRooms = create<RoomsState>()(
  persist(
    (set) => ({
      rooms: [],
      activeRoomId: null,
      isLoading: false,
      error: null,
      setRooms: (rooms) => set({ rooms, error: null }),
      addRoom: (room) => set((state) => ({
        rooms: [...state.rooms, room],
        error: null,
      })),
      updateRoom: (id, updates) => set((state) => ({
        rooms: state.rooms.map((room) =>
          room.id === id ? { ...room, ...updates } : room
        ),
        error: null,
      })),
      setActiveRoom: (roomId) => set({ activeRoomId: roomId }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'rooms-storage',
      partialize: (state) => ({
        rooms: state.rooms.map(({ id, name, lastMessage, lastMessageTime, unreadCount }) => ({
          id,
          name,
          lastMessage,
          lastMessageTime,
          unreadCount,
        })),
        activeRoomId: state.activeRoomId,
      }),
    }
  )
); 