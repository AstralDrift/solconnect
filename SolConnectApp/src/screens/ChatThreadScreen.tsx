import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Message } from '../types';
import SolChatSDK from '../SolChatSDK';
import { useToast } from '../components/Toast';
import { getMessageBus } from '../services/MessageBus';

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
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || isSending) return;

    try {
      setIsSending(true);
      setDraft('');

      // Add message to local state immediately
      const newMessage: Message = {
        sender_wallet: session.peer_wallet,
        ciphertext: text,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newMessage]);

      // Send encrypted message
      await SolChatSDK.send_encrypted_message(session, text);

      // Show success feedback
      showToast({
        type: 'success',
        title: 'Message sent',
        duration: 2000
      });

      // Poll for replies
      const replies = await SolChatSDK.poll_messages(session);
      if (replies.length > 0) {
        setMessages(prev => [...prev, ...replies]);
        
        // Store replies
        const messageBus = getMessageBus();
        await messageBus.storeMessages(session.session_id, replies);
      }
    } catch (err) {
      console.error('[ChatThread] Error sending message:', err);
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
                  marginTop: '4px'
                }}>
                  {new Date(message.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
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