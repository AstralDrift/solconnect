# SolConnect

A modern, real-time chat DApp built on Solana.

## 🚀 Quick Demo

![Demo GIF](demo/demo.gif)

Run the full demo with one command:

```bash
./demo.sh   # installs deps, runs validator, seeds data, opens app
```

### 🛠 One-Command Setup
```bash
git clone <repo>
cd SolConnectApp
./demo.sh          # validator, seed, relay, web client
```

Open [http://localhost:3000](http://localhost:3000) and enjoy!
Scan QR in console to load mobile build via Expo.

## Features

- 💬 Real-time messaging
- 🌓 Dark/light theme
- 🎨 Beautiful animations
- 📱 Responsive design
- 🔒 End-to-end encryption
- ⚡ Solana-powered

## Development

```bash
# Install dependencies
npm install

# Start local validator
solana-test-validator

# Start relay server
npm run relay

# Start web client
npm run dev

# Run tests
npm test
```

## Mobile Preview

```bash
npm run mobile  # Starts Expo dev client
```

## License

MIT 