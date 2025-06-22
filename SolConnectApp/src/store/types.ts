import { ChatSession, Message, MessageStatus, MessageStatusUpdate } from '../types';

export interface AuthState {
  wallet: string | null;
  isConnecting: boolean;
  error: string | null;
  setWallet: (wallet: string | null) => void;
  setConnecting: (isConnecting: boolean) => void;
  setError: (error: string | null) => void;
}

export interface Room {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  session?: ChatSession;
}

export interface RoomsState {
  rooms: Room[];
  activeRoomId: string | null;
  isLoading: boolean;
  error: string | null;
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoom: (id: string, updates: Partial<Room>) => void;
  setActiveRoom: (roomId: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export interface MessagesState {
  messages: Record<string, Message[]>; // roomId -> messages
  optimisticUpdates: Record<string, MessageStatus>; // messageId -> status for optimistic updates
  statusUpdateQueue: MessageStatusUpdate[]; // Queue for pending status updates
  isLoading: boolean;
  error: string | null;
  setMessages: (roomId: string, messages: Message[]) => void;
  addMessage: (roomId: string, message: Message) => void;
  addMessages: (roomId: string, messages: Message[]) => void;
  updateMessageStatus: (roomId: string, messageId: string, status: MessageStatus, optimistic?: boolean) => void;
  batchUpdateMessageStatus: (updates: MessageStatusUpdate[]) => void;
  clearOptimisticUpdate: (messageId: string) => void;
  queueStatusUpdate: (update: MessageStatusUpdate) => void;
  processStatusUpdateQueue: () => void;
  getMessageStatus: (messageId: string) => MessageStatus | null;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export interface StoreState extends AuthState, RoomsState, MessagesState {} 