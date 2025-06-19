import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_PEERS } from '../types/chat';
import SolChatSDK from '../SolChatSDK';
import { useToast } from '../components/Toast';
import MonitoringDashboard from '../components/monitoring/MonitoringDashboard';

export default function ChatListScreen(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { wallet } = location.state || {};
  const { showToast } = useToast();

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
      
      // Show user-friendly error toast
      showToast({
        type: 'error',
        title: 'Failed to start chat',
        message: 'Unable to establish connection with this peer. Please try again.',
        action: {
          label: 'Retry',
          onClick: () => handleChatPress(peer)
        }
      });
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
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => navigate('/monitoring')}
            style={{
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              color: '#666',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#10B981';
              e.currentTarget.style.color = '#10B981';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#ddd';
              e.currentTarget.style.color = '#666';
            }}
          >
            Monitor
          </button>
          <button
            onClick={() => navigate('/settings')}
            style={{
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              color: '#666',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#9945FF';
              e.currentTarget.style.color = '#9945FF';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#ddd';
              e.currentTarget.style.color = '#666';
            }}
          >
            Settings
          </button>
        </div>
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