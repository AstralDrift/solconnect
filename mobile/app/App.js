import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, SafeAreaView, Platform } from 'react-native';
import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const App = () => {
  const [wallet, setWallet] = useState(null);
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [status, setStatus] = useState('');

  // Connect to Solana devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  const connectWallet = async () => {
    try {
      // For web testing, we'll create a new keypair
      const newWallet = Keypair.generate();
      setWallet(newWallet);
      setStatus('Wallet connected!');
    } catch (error) {
      setStatus('Error connecting wallet: ' + error.message);
    }
  };

  const sendMessage = async () => {
    if (!wallet || !message) {
      setStatus('Please connect wallet and enter a message');
      return;
    }

    try {
      setStatus('Sending message...');
      
      // Create a simple transaction with the message
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: wallet.publicKey, // Sending to self for demo
          lamports: 0,
        })
      );

      // Sign the transaction
      const signedTx = await connection.sendTransaction(transaction, [wallet]);
      setSignature(signedTx);
      setStatus('Message sent! Check signature: ' + signedTx);
    } catch (error) {
      setStatus('Error sending message: ' + error.message);
    }
  };

  const verifyMessage = async () => {
    if (!signature) {
      setStatus('No signature to verify');
      return;
    }

    try {
      setStatus('Verifying message...');
      const tx = await connection.getTransaction(signature);
      
      if (tx) {
        setStatus('Message verified! Transaction confirmed.');
      } else {
        setStatus('Message verification failed: Transaction not found');
      }
    } catch (error) {
      setStatus('Error verifying message: ' + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>SolConnect Demo</Text>
        
        {!wallet ? (
          <TouchableOpacity style={styles.button} onPress={connectWallet}>
            <Text style={styles.buttonText}>Connect Wallet</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.walletInfo}>
            <Text style={styles.walletText}>
              Connected: {wallet.publicKey.toString().slice(0, 8)}...
            </Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Enter your message"
          value={message}
          onChangeText={setMessage}
          multiline
        />

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, !wallet && styles.buttonDisabled]} 
            onPress={sendMessage}
            disabled={!wallet}
          >
            <Text style={styles.buttonText}>Send Message</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, !signature && styles.buttonDisabled]} 
            onPress={verifyMessage}
            disabled={!signature}
          >
            <Text style={styles.buttonText}>Verify Message</Text>
          </TouchableOpacity>
        </View>

        {signature && (
          <View style={styles.signatureContainer}>
            <Text style={styles.signatureLabel}>Signature:</Text>
            <Text style={styles.signatureText}>{signature}</Text>
          </View>
        )}

        <Text style={styles.status}>{status}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  button: {
    backgroundColor: '#512da8',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#b39ddb',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  input: {
    backgroundColor: 'white',
    width: '100%',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  walletInfo: {
    backgroundColor: '#e8eaf6',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    marginBottom: 20,
  },
  walletText: {
    color: '#333',
    textAlign: 'center',
  },
  signatureContainer: {
    width: '100%',
    backgroundColor: '#e8eaf6',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  signatureLabel: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  signatureText: {
    color: '#666',
    fontSize: 12,
  },
  status: {
    marginTop: 20,
    color: '#666',
    textAlign: 'center',
  },
});

export default App; 