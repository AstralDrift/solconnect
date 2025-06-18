import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Message } from '../types';
import SolChatSDK from '../SolChatSDK';

export default function ChatThreadScreen(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { peerId } = useParams();
  const { session, peerName } = location.state || {};
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const initialMessages = await SolChatSDK.poll_messages(session);
        setMessages(initialMessages);
      } catch (err) {
        console.error('[ChatThread] Error loading messages:', err);
        alert('Failed to load messages. Please try again.');
      }
    };

    loadMessages();
  }, [session]);

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

      // Poll for replies
      const replies = await SolChatSDK.poll_messages(session);
      if (replies.length > 0) {
        setMessages(prev => [...prev, ...replies]);
      }
    } catch (err) {
      console.error('[ChatThread] Error sending message:', err);
      alert('Failed to send message. Please try again.');
      // Restore draft text on error
      setDraft(text);
    } finally {
      setIsSending(false);
    }
  }, [draft, session, isSending]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

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
        }}>
          {peerName}
        </h1>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '15px',
      }}>
        {messages.map((message, index) => (
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
            }}>
              {message.ciphertext}
            </div>
          </div>
        ))}
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
          }}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
} 