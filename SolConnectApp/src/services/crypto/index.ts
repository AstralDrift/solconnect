/**
 * Crypto module exports
 * Provides end-to-end encryption using Signal Protocol
 */

export {
  // Signal Protocol
  SignalProtocol,
  PreKeyBundle,
  SignedPreKey,
  OneTimePreKey,
  SessionState,
  EncryptedMessage,
  MessageHeader,
  SignalProtocolConfig,
  initializeSignalProtocol,
  getSignalProtocol,
} from './SignalProtocol';

export {
  // Key Storage
  KeyStorage,
  StoredIdentityKey,
  StoredPreKey,
  initializeKeyStorage,
  getKeyStorage,
} from './KeyStorage';

export {
  // Encryption Service
  EncryptionService,
  EncryptedPayload,
  EncryptionServiceConfig,
  MessageInterceptor,
  initializeEncryptionService,
  getEncryptionService,
} from './EncryptionService';

export {
  // Crypto Utilities
  CryptoUtils,
} from './CryptoUtils'; 