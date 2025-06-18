import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SolChatSDK from '../SolChatSDK';

export default function LoginScreen(): JSX.Element {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleLogin = async (): Promise<void> => {
    try {
      setBusy(true);
      setError(null);
      const wallet = await SolChatSDK.wallet_login();
      navigate('/chats', { state: { wallet } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login');
      console.error('[Login] Error:', err);
    } finally {
      setBusy(false);
    }
  };
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px',
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '24px', fontWeight: 'bold' }}>
        SolConnect Demo
      </h1>
      {error && (
        <p style={{ color: 'red', marginBottom: '16px' }}>{error}</p>
      )}
      {busy ? (
        <div>Loading...</div>
      ) : (
        <button 
          onClick={handleLogin}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#f4511e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Login with Wallet
        </button>
      )}
    </div>
  );
} 