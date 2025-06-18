import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_PEERS } from '../types/chat';
import SolChatSDK from '../SolChatSDK';

export default function ChatListScreen(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { wallet } = location.state || {};

  const handleChatPress = async (peer: typeof DEMO_PEERS[0]) => {
    try {
      const session = await SolChatSDK.start_session(peer.id);
      navigate(`/thread/${peer.id}`, {
        state: {
          session,
          peerName: peer.name
        }
      });
    } catch (err) {
      console.error('[ChatList] Error starting chat:', err);
      // TODO: Show error toast/alert
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
    }}>
      <div style={{
        padding: '16px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #ddd',
      }}>
        <p style={{
          fontSize: '16px',
          color: '#666',
          margin: 0,
        }}>
          Logged in as {wallet}
        </p>
      </div>
      <div style={{
        flex: 1,
        overflowY: 'auto',
      }}>
        {DEMO_PEERS.map((peer, index) => (
          <React.Fragment key={peer.id}>
            <div
              onClick={() => handleChatPress(peer)}
              style={{
                padding: '16px',
                backgroundColor: '#fff',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                ':hover': {
                  backgroundColor: '#f0f0f0',
                },
              }}
            >
              <h3 style={{ margin: 0 }}>{peer.name}</h3>
              <p style={{ margin: '4px 0 0', color: '#666' }}>{peer.id}</p>
            </div>
            {index < DEMO_PEERS.length - 1 && (
              <div style={{
                height: '1px',
                backgroundColor: '#ddd',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
} 