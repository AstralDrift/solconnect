#!/usr/bin/env bash

# SolConnect Cloud Agent Setup Script
# Installs all dependencies for OpenAI Codex cloud environment

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CACHE_DIR="${SCRIPT_DIR}/cache"
readonly MODELS_DIR="${SCRIPT_DIR}/models"

# Create cache directories
mkdir -p "${CACHE_DIR}" "${MODELS_DIR}"

# Detect OS
get_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unsupported"
    fi
}

# Install system packages
install_system_packages() {
    local os=$(get_os)
    
    case "$os" in
        "macos")
            # Install Homebrew if not present
            if ! command -v brew >/dev/null 2>&1; then
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)"
            fi
            
            # Install packages
            brew install git curl wget pkg-config cmake protobuf openssl libsodium
            ;;
        "linux")
            # Update package list
            if command -v apt-get >/dev/null 2>&1; then
                sudo apt-get update
                sudo apt-get install -y git curl wget build-essential pkg-config cmake \
                    protobuf-compiler libssl-dev libsodium-dev clang
            elif command -v yum >/dev/null 2>&1; then
                sudo yum update -y
                sudo yum groupinstall -y "Development Tools"
                sudo yum install -y git curl wget pkg-config cmake protobuf-compiler \
                    openssl-devel libsodium-devel clang
            fi
            ;;
        *)
            echo "Unsupported OS: $os" >&2
            exit 1
            ;;
    esac
}

# Install Rust
install_rust() {
    if ! command -v rustc >/dev/null 2>&1; then
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
        source "${HOME}/.cargo/env"
    fi
    
    # Add mobile targets
    rustup target add aarch64-linux-android aarch64-apple-ios
    
    # Install uniffi-cli for FFI bindings
    cargo install uniffi-cli --version 0.29.2 --force

    # Useful workflow helpers
    cargo install cargo-make --force
}

# Install Node.js
install_nodejs() {
    if ! command -v node >/dev/null 2>&1; then
        local os=$(get_os)
        case "$os" in
            "macos")
                brew install node@18
                ;;
            "linux")
                curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
                sudo apt-get install -y nodejs
                ;;
        esac
    fi

    # Configure npm cache
    mkdir -p "${CACHE_DIR}/npm"
    npm config set cache "${CACHE_DIR}/npm"

    # Tools useful for React Native development
    npm install -g expo-cli
}

# Install Solana CLI
install_solana_cli() {
    if ! command -v solana >/dev/null 2>&1; then
        sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
        export PATH="${HOME}/.local/share/solana/install/active_release/bin:$PATH"
    fi
    
    # Configure for devnet
    solana config set --url https://api.devnet.solana.com
    
    # Generate keypair if needed
    if [[ ! -f "${HOME}/.config/solana/id.json" ]]; then
        solana-keygen new --no-bip39-passphrase --silent
    fi
}

# Install Docker
install_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        local os=$(get_os)
        case "$os" in
            "linux")
                curl -fsSL https://get.docker.com | sh
                sudo usermod -aG docker "$USER"
                ;;
        esac
    fi
}

# Install project dependencies
install_project_dependencies() {
    cd "${SCRIPT_DIR}"
    
    # Cache Rust dependencies
    if [[ -f "Cargo.toml" ]]; then
        export CARGO_HOME="${CACHE_DIR}/cargo"
        cargo fetch --locked
        cargo build --workspace
    fi
    
    # Install Node.js dependencies for each project
    local projects=("SolConnectApp" "apps/solchat_mobile" "encrypted-chat" "mobile/app")
    
    for project in "${projects[@]}"; do
        if [[ -d "$project" && -f "$project/package.json" ]]; then
            cd "$project"
            npm ci --cache "${CACHE_DIR}/npm" --prefer-offline
            cd "${SCRIPT_DIR}"
        fi
    done
}

# Configure environment
configure_environment() {
    # Create environment configuration
    cat > "${SCRIPT_DIR}/.env" << EOF
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
SOLANA_COMMITMENT=confirmed

# Relay Configuration
RELAY_PORT=8080
RELAY_HOST=localhost

# Next.js Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_RELAY_URL=ws://localhost:8080

# Mobile Configuration
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
EXPO_PUBLIC_RELAY_URL=ws://localhost:8080

# Development
NODE_ENV=development
EOF
}

# Main installation
main() {
    echo "Setting up SolConnect for cloud agent environment..."
    
    install_system_packages
    install_rust
    install_nodejs
    install_solana_cli
    install_docker
    install_project_dependencies
    configure_environment
    
    echo "Setup complete!"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi