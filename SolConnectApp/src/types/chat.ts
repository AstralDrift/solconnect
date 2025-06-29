export interface ChatPeer {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

export interface ChatListItemProps {
  item: ChatPeer;
  onPress: () => void;
}

// Reaction-related types
export interface MessageReaction {
  id: string;
  messageId: string;
  userAddress: string;
  emoji: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  userAddresses: string[];
  firstReactionAt: Date;
  lastReactionAt: Date;
  currentUserReacted: boolean;
}

export interface EmojiReaction {
  emoji: string;
  count: number;
  users: string[];
  currentUserReacted: boolean;
}

export interface ReactionPickerEmoji {
  emoji: string;
  name: string;
  keywords: string[];
  category: string;
}

export interface UserEmojiHistory {
  emoji: string;
  usageCount: number;
  lastUsedAt: Date;
}

export interface ReactionEvent {
  type: 'reaction_added' | 'reaction_removed';
  messageId: string;
  sessionId: string;
  emoji: string;
  userAddress: string;
  timestamp: string;
}

export interface ReactionEventHandler {
  (event: ReactionEvent): void;
}

// Enhanced message interface with reactions
export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions?: EmojiReaction[];
}

export const DEMO_PEERS: ChatPeer[] = [
  {
    id: 'alice.sol',
    name: 'Chat with Alice',
    lastMessage: 'Hey there!',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 0
  },
  {
    id: 'bob.sol',
    name: 'Chat with Bob',
    lastMessage: 'How are you?',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 2
  }
]; 