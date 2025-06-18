export default {
  wallet_login: async () => {
    await new Promise(r => setTimeout(r, 300));
    return 'solDemoWallet123';
  },
  start_session: async peer => ({ session_id: Date.now().toString(), peer_wallet: peer }),
  send_encrypted_message: async (s, text) => console.log('[SDK] send', text),
  poll_messages: async s => [{ sender_wallet: s.peer_wallet, ciphertext: `🔒 echo: ${Date.now()}` }],
}; 