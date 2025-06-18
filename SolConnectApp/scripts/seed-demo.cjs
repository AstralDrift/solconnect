const web3 = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

async function seedDemo() {
  const connection = new web3.Connection('http://127.0.0.1:8899', 'confirmed');

  // Generate demo users
  const alice = web3.Keypair.generate();
  const bob = web3.Keypair.generate();

  console.log('Generated demo users:');
  console.log('Alice:', alice.publicKey.toString());
  console.log('Bob:', bob.publicKey.toString());

  // Airdrop SOL
  const airdropAmount = 5 * web3.LAMPORTS_PER_SOL;
  
  console.log('Requesting airdrop for Alice...');
  const aliceSig = await connection.requestAirdrop(alice.publicKey, airdropAmount);
  await connection.confirmTransaction(aliceSig);
  
  console.log('Requesting airdrop for Bob...');
  const bobSig = await connection.requestAirdrop(bob.publicKey, airdropAmount);
  await connection.confirmTransaction(bobSig);

  // Create demo data
  const demoData = {
    users: [
      {
        name: 'Alice',
        publicKey: alice.publicKey.toString(),
        privateKey: Buffer.from(alice.secretKey).toString('hex'),
      },
      {
        name: 'Bob',
        publicKey: bob.publicKey.toString(),
        privateKey: Buffer.from(bob.secretKey).toString('hex'),
      },
    ],
    room: {
      name: 'General',
      id: 'general',
      messages: [
        { type: 'system', content: 'Welcome to SolConnect! This is a demo room with sample messages.' },
        { sender: 'Alice', content: '👋 Welcome to SolConnect!' },
        { sender: 'Bob', content: 'Thanks! This looks great.' },
        { sender: 'Alice', content: 'Feel free to explore the features.' },
        { sender: 'Bob', content: 'The UI is really smooth.' },
        { sender: 'Alice', content: 'Built with React + Tailwind + Framer Motion.' },
        { sender: 'Bob', content: 'And running on Solana! 🚀' },
        { sender: 'Alice', content: 'Check out the dark mode toggle.' },
        { sender: 'Bob', content: 'Nice animations too!' },
        { sender: 'Alice', content: 'Try sending a message...' },
        { sender: 'Bob', content: 'This is awesome! 🎉' },
      ],
    },
  };

  // Save demo data
  const demoPath = path.join(__dirname, '..', 'src', 'data', 'demo.json');
  fs.mkdirSync(path.dirname(demoPath), { recursive: true });
  fs.writeFileSync(demoPath, JSON.stringify(demoData, null, 2));

  console.log('Demo data seeded successfully!');
}

seedDemo().catch(console.error); 