# SolConnect Developer Guide

This document outlines how to set up a local development environment and deploy SolConnect.

## Setup

1. Run `./setup.sh` to install dependencies.
2. Start the Solana test validator:
   ```bash
   solana-test-validator --reset
   ```
3. Start the relay server:
   ```bash
   cargo run -p solchat_relay
   ```
4. Launch the web app with hot reload:
   ```bash
   cd SolConnectApp
   npm run dev
   ```
5. Launch the mobile app:
   ```bash
   cd apps/solchat_mobile
   npm start
   ```

## Kubernetes Deployment

A sample Kubernetes setup is provided under `infra/k8s`. Deploy with:
```bash
kubectl apply -k infra/k8s
```

A Helm chart is available under `infra/helm/solconnect`:
```bash
helm install solconnect infra/helm/solconnect
```

## VS Code

Recommended extensions are defined in `.vscode/extensions.json`. These provide Rust and TypeScript tooling along with Docker integration.

