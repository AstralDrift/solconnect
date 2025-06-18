# Developer Setup Guide

This document describes how to get a local development environment running quickly.

## Prerequisites
- Docker 20+
- Node.js 18+
- Rust 1.81+
- Solana CLI tools

## Quick Start
```bash
./setup.sh          # installs system tooling and dependencies
npm run relay       # start the local relay server
```

## Hot Reloading
- React Native: `npm run android` or `npm run ios` in `apps/solchat_mobile`
- Web app: `npm run dev` inside `SolConnectApp`

## Debugging
Use the provided VS Code launch configuration *Debug Relay* to attach to the relay server.
