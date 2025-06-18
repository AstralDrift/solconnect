#!/bin/bash

# Exit on error
set -e

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Set defaults if not provided
export SOLANA_RPC_URL=${SOLANA_RPC_URL:-"https://api.devnet.solana.com"}
export SOLANA_NETWORK=${SOLANA_NETWORK:-"devnet"}

# Print configuration
echo "Configuration:"
echo "RPC URL: $SOLANA_RPC_URL"
echo "Network: $SOLANA_NETWORK"
if [ -z "$WALLET_PRIVATE_KEY" ]; then
  echo "Wallet: Using ephemeral wallet (will be generated)"
else
  echo "Wallet: Using provided private key"
fi

# Run profiling
SCRIPT_DIR="$(dirname "$0")"
echo "Running CU profiling..."
node "$SCRIPT_DIR/profile-cu.cjs" "$@"

echo "Profiling complete. Results saved in docs/perf/" 