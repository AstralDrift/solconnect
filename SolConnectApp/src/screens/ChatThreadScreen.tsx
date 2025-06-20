import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Message } from '../types';
import SolChatSDK from '../SolChatSDK';
import { useToast } from '../components/Toast';
import { getMessageBus } from '../services/MessageBus';

// Status icon component
const StatusIcon = ({ status }: { status?: string }) => {
  if (!status) return null;
  
  const getIcon = () => {
    switch (status) {
      case 'sent':
        return '✓'; // Single checkmark
      case 'delivered':
        return '✓✓'; // Double checkmark
      case 'read':
        return <span style={{ color: '#9945FF' }}>✓✓</span>; // Colored double checkmark
      default:
        return '◦'; // Pending
    }
  };
  
  return (
    <span style={{
      marginLeft: '4px',
      fontSize: '12px',
      opacity: 0.7
    }}>
      {getIcon()}
    </span>
  );
};

export default function ChatThreadScreen(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { peerId } = useParams();
  const { session, peerName } = location.state || {};
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const loadMessages = async () => {
      if (!session) {
        showToast({
          type: 'error',
          title: 'Session not found',
          message: 'Please start a new chat session.'
        });
        navigate('/chats');
        return;
      }

      try {
        setIsLoading(true);
        
        // First, try to load persisted messages
        const messageBus = getMessageBus();
        const storedResult = await messageBus.getStoredMessages(session.session_id, 100);
        
        if (storedResult.success && storedResult.data!.length > 0) {
          setMessages(storedResult.data!);
        }
        
        // Then, poll for any new messages
        const initialMessages = await SolChatSDK.poll_messages(session);
        if (initialMessages.length > 0) {
          // Merge with stored messages, avoiding duplicates
          const existingTimestamps = new Set(messages.map(m => m.timestamp));
          const newMessages = initialMessages.filter(m => !existingTimestamps.has(m.timestamp));
          
          if (newMessages.length > 0) {
            setMessages(prev => [...prev, ...newMessages]);
            
            // Store new messages
            await messageBus.storeMessages(session.session_id, newMessages);
          }
        }
      } catch (err) {
        console.error('[ChatThread] Error loading messages:', err);
        showToast({
          type: 'error',
          title: 'Failed to load messages',
          message: 'Unable to load chat history. Please try again.',
          action: {
            label: 'Retry',
            onClick: loadMessages
          }
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [session, navigate, showToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Mark visible messages as read
    const markMessagesAsRead = async () => {
      if (!session || messages.length === 0) return;
      
      const messageBus = getMessageBus();
      
      // Find unread messages from the peer
      const unreadMessages = messages.filter(msg => 
        msg.sender_wallet !== session.peer_wallet && // Messages from peer
        (!msg.status || msg.status !== 'read') // Not already read
      );
      
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(msg => 
          // Use timestamp as message ID if no explicit ID
          msg.timestamp || new Date().toISOString()
        );
        
        // Send read receipts
        await messageBus.markMessagesAsRead(session.session_id, messageIds);
        
        // Update local state
        setMessages(prev => prev.map(msg => {
          if (messageIds.includes(msg.timestamp || '')) {
            return { ...msg, status: 'read' };
          }
          return msg;
        }));
      }
    };
    
    markMessagesAsRead();
  }, [messages, session]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || isSending) return;

    // Declare newMessage outside try block so it's accessible in catch
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMessage: Message = {
      sender_wallet: session.peer_wallet,
      ciphertext: text,
      timestamp: new Date().toISOString(),
      status: 'pending' as const
    };

    try {
      setIsSending(true);
      setDraft('');

      // Add message to local state immediately with 'pending' status
      setMessages(prev => [...prev, newMessage]);

      // Send encrypted message through MessageBus
      const messageBus = getMessageBus();
      const result = await messageBus.sendMessage(session, text);
      
      if (result.success && result.data) {
        // Update message status based on delivery receipt
        setMessages(prev => prev.map(msg => 
          msg.timestamp === newMessage.timestamp 
            ? { ...msg, status: result.data!.status } 
            : msg
        ));
        
        // Show success feedback only if actually sent (not queued)
        if (result.data.status === 'sent') {
          showToast({
            type: 'success',
            title: 'Message sent',
            duration: 2000
          });
        } else if (result.data.status === 'queued') {
          showToast({
            type: 'info',
            title: 'Message queued',
            message: 'Your message will be sent when connection is restored.',
            duration: 3000
          });
        }
      }

      // Poll for replies
      const replies = await SolChatSDK.poll_messages(session);
      if (replies.length > 0) {
        setMessages(prev => [...prev, ...replies]);
        
        // Store replies
        await messageBus.storeMessages(session.session_id, replies);
      }
    } catch (err) {
      console.error('[ChatThread] Error sending message:', err);
      
      // Update message status to failed
      setMessages(prev => prev.map(msg => 
        msg.timestamp === newMessage.timestamp 
          ? { ...msg, status: 'failed' as const } 
          : msg
      ));
      
      showToast({
        type: 'error',
        title: 'Failed to send message',
        message: 'Unable to send your message. Please try again.',
        action: {
          label: 'Retry',
          onClick: () => {
            setDraft(text);
            sendMessage();
          }
        }
      });
      // Restore draft text on error
      setDraft(text);
    } finally {
      setIsSending(false);
    }
  }, [draft, session, isSending, showToast]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const clearChat = useCallback(async () => {
    if (window.confirm('Are you sure you want to clear this chat history? This cannot be undone.')) {
      try {
        const messageBus = getMessageBus();
        await messageBus.clearStoredMessages(session.session_id);
        setMessages([]);
        showToast({
          type: 'success',
          title: 'Chat cleared',
          message: 'Chat history has been cleared.'
        });
      } catch (err) {
        console.error('[ChatThread] Error clearing chat:', err);
        showToast({
          type: 'error',
          title: 'Failed to clear chat',
          message: 'Unable to clear chat history. Please try again.'
        });
      }
    }
  }, [session, showToast]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#666'
        }}>
          <div style={{
            fontSize: '24px',
            marginBottom: '10px'
          }}>
            Loading messages...
          </div>
          <div style={{
            fontSize: '14px'
          }}>
            Please wait while we load your chat history
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '15px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #eee',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            marginRight: '15px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            color: '#9945FF',
            cursor: 'pointer',
          }}
        >
          ←
        </button>
        <h1 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#333',
          margin: 0,
          flex: 1,
        }}>
          {peerName}
        </h1>
        <button
          onClick={clearChat}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '5px 10px',
          }}
          title="Clear chat history"
        >
          Clear
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '15px',
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#999',
            marginTop: '50px',
            fontSize: '14px'
          }}>
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: message.sender_wallet === session.peer_wallet ? 'flex-end' : 'flex-start',
                marginBottom: '10px',
              }}
            >
              <div style={{
                maxWidth: '70%',
                padding: '10px 15px',
                borderRadius: '20px',
                backgroundColor: message.sender_wallet === session.peer_wallet ? '#9945FF' : '#fff',
                color: message.sender_wallet === session.peer_wallet ? '#fff' : '#333',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
              }}>
                <div>{message.ciphertext}</div>
                <div style={{
                  fontSize: '11px',
                  opacity: 0.7,
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: message.sender_wallet === session.peer_wallet ? 'flex-end' : 'flex-start'
                }}>
                  {new Date(message.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                  {message.sender_wallet === session.peer_wallet && (
                    <StatusIcon status={message.status} />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{
        display: 'flex',
        padding: '10px',
        backgroundColor: '#fff',
        borderTop: '1px solid #eee',
      }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={isSending}
          style={{
            flex: 1,
            backgroundColor: '#f0f0f0',
            borderRadius: '20px',
            padding: '10px 15px',
            marginRight: '10px',
            border: 'none',
            fontSize: '16px',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!draft.trim() || isSending}
          style={{
            backgroundColor: !draft.trim() || isSending ? '#ccc' : '#9945FF',
            borderRadius: '20px',
            padding: '10px 20px',
            border: 'none',
            color: '#fff',
            cursor: !draft.trim() || isSending ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
} 