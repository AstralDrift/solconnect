// Replace these stubs with your real native/JS bridge later
export default {
  wallet_login: async () => {
    // simulate wallet auth delay
    await new Promise(res => setTimeout(res, 500));
    return 'solDemoWallet123';
  },

  start_session: async (peerWallet) => {
    return { session_id: `sess-${Date.now()}`, peer_wallet: peerWallet };
  },

  send_encrypted_message: async (session, plaintext) => {
    // In real: send via FFI and relay
    console.log(`[SDK] send to ${session.peer_wallet}: ${plaintext}`);
  },

  poll_messages: async (session) => {
    // Fake incoming echo
    return [
      {
        sender_wallet: session.peer_wallet,
        ciphertext: `🔒${Date.now()}: Echoed back!`
      }
    ];
  }
}; 