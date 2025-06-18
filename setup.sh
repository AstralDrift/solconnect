#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_DIR="${SCRIPT_DIR}/cache"
MODELS_DIR="${SCRIPT_DIR}/models"

mkdir -p "$CACHE_DIR" "$MODELS_DIR"

get_os() {
  case "$(uname -s)" in
    Darwin) echo macos ;;
    Linux) echo linux ;;
    *) echo unsupported ;;
  esac
}

install_system_packages() {
  local os="$(get_os)"
  if [[ "$os" == "macos" ]]; then
    if ! command -v brew >/dev/null 2>&1; then
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      eval "$(brew shellenv)"
    fi
    brew install git curl wget pkg-config cmake protobuf openssl libsodium watchman
  elif [[ "$os" == "linux" ]]; then
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update
      sudo apt-get install -y git curl wget build-essential pkg-config cmake protobuf-compiler libssl-dev libsodium-dev clang watchman
    fi
  else
    echo "Unsupported OS" >&2
    exit 1
  fi
}

install_rust() {
  if ! command -v rustc >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    source "$HOME/.cargo/env"
  fi
  rustup target add aarch64-linux-android aarch64-apple-ios
  cargo install uniffi-cli --version 0.29.2 --force
}

install_node() {
  if ! command -v node >/dev/null 2>&1; then
    local os="$(get_os)"
    if [[ "$os" == "linux" ]]; then
      curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
      sudo apt-get install -y nodejs
    else
      brew install node@18
    fi
  fi
  mkdir -p "$CACHE_DIR/npm"
  npm config set cache "$CACHE_DIR/npm"
}

install_solana_cli() {
  if ! command -v solana >/dev/null 2>&1; then
    sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
  fi
  solana config set --url https://api.devnet.solana.com
  if [[ ! -f "$HOME/.config/solana/id.json" ]]; then
    solana-keygen new --no-bip39-passphrase --silent
  fi
}

install_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER" || true
  fi
}

install_project_deps() {
  export CARGO_HOME="$CACHE_DIR/cargo"
  cargo fetch --locked
  cargo build --workspace

  local projects=("SolConnectApp" "apps/solchat_mobile" "encrypted-chat" "mobile/app")
  for p in "${projects[@]}"; do
    if [[ -f "$p/package.json" ]]; then
      (cd "$p" && npm ci --cache "$CACHE_DIR/npm" --prefer-offline)
    fi
  done
}

configure_env() {
  cat > "$SCRIPT_DIR/.env" <<EOL
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
SOLANA_COMMITMENT=confirmed
RELAY_PORT=8080
RELAY_HOST=localhost
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_RELAY_URL=ws://localhost:8080
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
EXPO_PUBLIC_RELAY_URL=ws://localhost:8080
NODE_ENV=development
EOL
}

main() {
  echo "Setting up SolConnect development environment..."
  install_system_packages
  install_rust
  install_node
  install_solana_cli
  install_docker
  install_project_deps
  configure_env
  echo "Setup complete!"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
