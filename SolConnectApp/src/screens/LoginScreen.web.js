import React, {useState} from 'react';
import {useRouter} from 'next/router';
import SolChatSDK from '../SolChatSDK';
import QRCode from 'qrcode.react';

export default function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  
  const handleLogin = async () => {
    setBusy(true);
    try {
      const w = await SolChatSDK.wallet_login();
      router.push({
        pathname: '/chats',
        query: { wallet: JSON.stringify(w) }
      });
    } catch (error) {
      console.error('Login error:', error);
      setBusy(false);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.glassContainer}>
        <div style={styles.content}>
          <h1 style={styles.heading}>SolConnect</h1>
          <p style={styles.subheading}>Secure, Decentralized Messaging</p>
          
          {busy ? (
            <div style={styles.loaderContainer}>
              <div style={styles.loader}></div>
            </div>
          ) : (
            <button 
              style={styles.button}
              onClick={handleLogin}
            >
              Connect Wallet
            </button>
          )}

          <div style={styles.divider}>
            <span style={styles.dividerText}>or</span>
          </div>

          <div style={styles.mobileSection}>
            <p style={styles.mobileText}>Get the mobile app</p>
            <div style={styles.qrContainer}>
              <QRCode 
                value="https://play.google.com/store/apps/details?id=com.solconnect.app"
                size={128}
                level="H"
                includeMargin={true}
                style={styles.qrCode}
              />
            </div>
            <p style={styles.scanText}>Scan to download</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    padding: '20px',
  },
  glassContainer: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  heading: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: '#fff',
    margin: '0',
    background: 'linear-gradient(45deg, #00f2fe, #4facfe)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subheading: {
    fontSize: '1.1rem',
    color: 'rgba(255, 255, 255, 0.7)',
    margin: '0',
    textAlign: 'center',
  },
  button: {
    background: 'linear-gradient(45deg, #00f2fe, #4facfe)',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 32px',
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    width: '100%',
    maxWidth: '280px',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 20px rgba(0, 242, 254, 0.3)',
    },
  },
  loaderContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '60px',
  },
  loader: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '50%',
    borderTopColor: '#00f2fe',
    animation: 'spin 1s linear infinite',
  },
  divider: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    margin: '16px 0',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '0.9rem',
  },
  mobileSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  mobileText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '1rem',
    margin: '0',
  },
  qrContainer: {
    background: 'rgba(255, 255, 255, 0.1)',
    padding: '16px',
    borderRadius: '12px',
    backdropFilter: 'blur(5px)',
  },
  qrCode: {
    borderRadius: '8px',
  },
  scanText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '0.9rem',
    margin: '0',
  },
}; 