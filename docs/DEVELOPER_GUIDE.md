# Developer Guide

Welcome to the SolConnect project! This guide will help you get a local
development environment running quickly.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Rust toolchain (installed via `rustup`)

## Quick Start

```bash
# Install all tooling and dependencies
./setup.sh

# Start the Solana test validator
solana-test-validator --reset &

# Run the relay server
cargo run -p solchat_relay

# In a separate terminal, start the mobile app
cd apps/solchat_mobile
npm start
```

## VS Code

The repository includes a `.vscode` folder with useful launch
configurations and extension recommendations. After opening the project in VS Code you
will be prompted to install the recommended extensions.

## Kubernetes Deployment

Example manifests can be found in `infra/k8s` and a Helm chart in
`infra/helm/solconnect`. These resources can be deployed to any Kubernetes
cluster:

```bash
kubectl apply -f infra/k8s/relay-deployment.yaml
kubectl apply -f infra/k8s/web-deployment.yaml
```

For advanced scenarios use the Helm chart:

```bash
helm install solconnect infra/helm/solconnect
```
