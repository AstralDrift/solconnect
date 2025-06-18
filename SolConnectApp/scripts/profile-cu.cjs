const anchor = require('@project-serum/anchor/dist/cjs');
const web3 = require('@solana/web3.js');
const BN = require('bn.js');
const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} ProfileResult
 * @property {string} operation
 * @property {number} cuUsed
 * @property {string} timestamp
 * @property {string} network
 * @property {number} messageSize
 * @property {boolean} success
 * @property {string=} error
 */

class CUProfiler {
  /**
   * @param {string} endpoint
   * @param {Uint8Array|null} privateKey
   * @param {'devnet'|'mainnet-beta'} network
   */
  constructor(endpoint, privateKey, network) {
    this.connection = new web3.Connection(endpoint, 'confirmed');
    this.network = network;
    if (privateKey && privateKey.length > 0) {
      const keypair = web3.Keypair.fromSecretKey(privateKey);
      this.wallet = new anchor.Wallet(keypair);
      this.isEphemeral = false;
    } else {
      const keypair = web3.Keypair.generate();
      this.wallet = new anchor.Wallet(keypair);
      this.isEphemeral = true;
      console.log(`Generated ephemeral wallet: ${keypair.publicKey.toString()}`);
    }
    this.provider = new anchor.AnchorProvider(
      this.connection,
      this.wallet,
      { commitment: 'confirmed' }
    );
    this.results = [];
  }

  async initialize() {
    if (this.isEphemeral) {
      console.log('Requesting airdrop for ephemeral wallet...');
      const signature = await this.connection.requestAirdrop(
        this.wallet.publicKey,
        web3.LAMPORTS_PER_SOL
      );
      console.log(`Airdrop signature: ${signature}`);
      await this.connection.confirmTransaction(signature);
      console.log('Airdrop confirmed');

      // Generate and fund receiver keypair
      this.receiverKeypair = web3.Keypair.generate();
      console.log(`Generated receiver wallet: ${this.receiverKeypair.publicKey.toString()}`);
      
      console.log('Requesting airdrop for receiver wallet...');
      const receiverSignature = await this.connection.requestAirdrop(
        this.receiverKeypair.publicKey,
        web3.LAMPORTS_PER_SOL / 10
      );
      console.log(`Receiver airdrop signature: ${receiverSignature}`);
      await this.connection.confirmTransaction(receiverSignature);
      console.log('Receiver airdrop confirmed');
    }
  }

  /**
   * @param {() => Promise<web3.TransactionSignature>} operation
   * @param {string} name
   * @param {number} messageSize
   */
  async measureCU(operation, name, messageSize) {
    try {
      const signature = await operation();
      const txInfo = await this.connection.getTransaction(signature, { commitment: "confirmed" });
      const cu = txInfo?.meta?.computeUnitsConsumed ?? 0;
      
      this.results.push({
        operation: name,
        payloadSize: this.formatPayloadSize(messageSize),
        computeUnits: cu,
        timestamp: new Date().toISOString(),
        network: this.network,
        success: true
      });
      console.log(`[${name}] CU used: ${cu}`);
    } catch (err) {
      console.error(`[${name}] Error:`, err);
      this.results.push({
        operation: name,
        payloadSize: this.formatPayloadSize(messageSize),
        computeUnits: 0,
        timestamp: new Date().toISOString(),
        network: this.network,
        success: false,
        error: err && err.message ? err.message : String(err)
      });
    }
  }

  formatPayloadSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
    return `${Math.round(bytes / (1024 * 1024))} MiB`;
  }

  async saveResults(filename) {
    const outputPath = path.join(__dirname, '..', 'docs', 'perf', filename);
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(this.results, null, 2)
    );
  }
}

async function main() {
  // Load environment variables with defaults
  const endpoint = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899';
  let privateKey = null;
  if (process.env.WALLET_PRIVATE_KEY) {
    try {
      privateKey = new Uint8Array(JSON.parse(process.env.WALLET_PRIVATE_KEY));
    } catch (e) {
      console.error('Invalid WALLET_PRIVATE_KEY:', e);
      process.exit(1);
    }
  }
  const network = (process.env.SOLANA_NETWORK || 'localnet');

  const profiler = new CUProfiler(endpoint, privateKey, network);
  await profiler.initialize();

  // Test message sizes (in bytes)
  const messageSizes = [32, 1024, 10240]; // tiny, medium, large

  for (const size of messageSizes) {
    // Profile room creation
    await profiler.measureCU(
      async () => {
        const tx = new web3.Transaction().add(
          web3.SystemProgram.transfer({
            fromPubkey: profiler.wallet.publicKey,
            toPubkey: profiler.receiverKeypair.publicKey,
            lamports: 0
          })
        );
        return await profiler.provider.sendAndConfirm(tx);
      },
      'create_room',
      size
    );

    // Profile message send
    await profiler.measureCU(
      async () => {
        const tx = new web3.Transaction().add(
          web3.SystemProgram.transfer({
            fromPubkey: profiler.wallet.publicKey,
            toPubkey: profiler.receiverKeypair.publicKey,
            lamports: 0
          })
        );
        return await profiler.provider.sendAndConfirm(tx);
      },
      'send_message',
      size
    );

    // Profile room close
    await profiler.measureCU(
      async () => {
        const tx = new web3.Transaction().add(
          web3.SystemProgram.transfer({
            fromPubkey: profiler.wallet.publicKey,
            toPubkey: profiler.receiverKeypair.publicKey,
            lamports: 0
          })
        );
        return await profiler.provider.sendAndConfirm(tx);
      },
      'close_room',
      size
    );
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await profiler.saveResults(`cu-profile-${network}-${timestamp}.json`);
}

if (require.main === module) {
  main().catch(console.error);
} 