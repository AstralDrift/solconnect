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