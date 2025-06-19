#!/usr/bin/env bash

# AI Agent Repository Setup Script for SolConnect
# Discovers all dependencies and prepares the environment for AI agent execution

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CACHE_DIR="${SCRIPT_DIR}/cache"
readonly MODELS_DIR="${SCRIPT_DIR}/models"
readonly LOG_FILE="${SCRIPT_DIR}/ai-agent-setup.log"

# Logging functions
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

info() {
    log "[INFO] $*"
}

error() {
    log "[ERROR] $*" >&2
}

success() {
    log "[SUCCESS] $*"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
get_os() {
    case "$OSTYPE" in
        darwin*) echo "macos" ;;
        linux*) echo "linux" ;;
        *) echo "unsupported" ;;
    esac
}

# Create necessary directories
setup_directories() {
    info "Creating cache and models directories"
    mkdir -p "${CACHE_DIR}" "${MODELS_DIR}"
    mkdir -p "${CACHE_DIR}/npm" "${CACHE_DIR}/cargo" "${CACHE_DIR}/docker"
    success "Directories created"
}

# Install system packages
install_system_packages() {
    local os=$(get_os)
    info "Installing system packages for $os"
    
    case "$os" in
        "macos")
            # Install Homebrew if not present
            if ! command_exists brew; then
                info "Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)"
            fi
            
            # Install required packages
            local packages=(git curl wget pkg-config cmake protobuf openssl libsodium)
            for pkg in "${packages[@]}"; do
                if ! brew list "$pkg" >/dev/null 2>&1; then
                    info "Installing $pkg..."
                    brew install "$pkg"
                fi
            done
            ;;
        "linux")
            if command_exists apt-get; then
                sudo apt-get update
                sudo apt-get install -y git curl wget build-essential pkg-config cmake \
                    protobuf-compiler libssl-dev libsodium-dev clang
            elif command_exists yum; then
                sudo yum update -y
                sudo yum groupinstall -y "Development Tools"
                sudo yum install -y git curl wget pkg-config cmake protobuf-compiler \
                    openssl-devel libsodium-devel clang
            elif command_exists dnf; then
                sudo dnf update -y
                sudo dnf groupinstall -y "Development Tools"
                sudo dnf install -y git curl wget pkg-config cmake protobuf-compiler \
                    openssl-devel libsodium-devel clang
            fi
            ;;
        *)
            error "Unsupported OS: $os"
            exit 1
            ;;
    esac
    
    success "System packages installed"
}

# Install Rust toolchain
install_rust() {
    info "Setting up Rust toolchain"
    
    if ! command_exists rustc; then
        info "Installing Rust via rustup..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
        source "${HOME}/.cargo/env"
    else
        info "Rust already installed: $(rustc --version)"
    fi
    
    # Install mobile targets
    info "Adding mobile compilation targets..."
    rustup target add aarch64-linux-android aarch64-apple-ios
    
    # Install uniffi-cli for FFI bindings
    if ! command_exists uniffi-bindgen; then
        info "Installing uniffi-cli..."
        cargo install uniffi-cli --version 0.29.2 --force
    fi
    
    # Configure cargo cache
    export CARGO_HOME="${CACHE_DIR}/cargo"
    echo "export CARGO_HOME=\"${CACHE_DIR}/cargo\"" >> "${HOME}/.bashrc" 2>/dev/null || true
    
    success "Rust toolchain configured"
}

# Install Node.js
install_nodejs() {
    info "Setting up Node.js environment"
    
    if ! command_exists node; then
        local os=$(get_os)
        case "$os" in
            "macos")
                brew install node@18
                brew link node@18 --force
                ;;
            "linux")
                curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
                sudo apt-get install -y nodejs
                ;;
        esac
    else
        local version=$(node --version | sed 's/v//' | cut -d'.' -f1)
        if [[ "$version" -lt 18 ]]; then
            error "Node.js version $(node --version) is too old. Require v18+"
            exit 1
        fi
        info "Node.js already installed: $(node --version)"
    fi
    
    # Configure npm cache
    npm config set cache "${CACHE_DIR}/npm"
    
    success "Node.js environment configured"
}

# Install Solana CLI
install_solana_cli() {
    info "Setting up Solana CLI tools"
    
    if ! command_exists solana; then
        info "Installing Solana CLI..."
        sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
        export PATH="${HOME}/.local/share/solana/install/active_release/bin:$PATH"
        echo 'export PATH="${HOME}/.local/share/solana/install/active_release/bin:$PATH"' >> "${HOME}/.bashrc" 2>/dev/null || true
    else
        info "Solana CLI already installed: $(solana --version)"
    fi
    
    # Configure for devnet
    solana config set --url https://api.devnet.solana.com
    
    # Generate keypair if needed
    if [[ ! -f "${HOME}/.config/solana/id.json" ]]; then
        info "Generating development keypair..."
        solana-keygen new --no-bip39-passphrase --silent
    fi
    
    success "Solana CLI configured"
}

# Install Docker
install_docker() {
    info "Checking Docker installation"
    
    if ! command_exists docker; then
        local os=$(get_os)
        case "$os" in
            "linux")
                info "Installing Docker..."
                curl -fsSL https://get.docker.com | sh
                sudo usermod -aG docker "$USER"
                info "Docker installed. May need to re-login for group membership."
                ;;
            "macos")
                error "Please install Docker Desktop manually from https://docker.com/products/docker-desktop"
                ;;
        esac
    else
        info "Docker already installed: $(docker --version)"
    fi
    
    success "Docker check completed"
}

# Install Kubernetes tools
install_k8s_tools() {
    info "Installing Kubernetes tools"
    
    # Install kubectl
    if ! command_exists kubectl; then
        local os=$(get_os)
        case "$os" in
            "macos")
                brew install kubectl
                ;;
            "linux")
                curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
                sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
                rm kubectl
                ;;
        esac
    else
        info "kubectl already installed: $(kubectl version --client --short 2>/dev/null || echo 'kubectl available')"
    fi
    
    # Install k3d for local development
    if ! command_exists k3d; then
        info "Installing k3d..."
        curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
    else
        info "k3d already installed: $(k3d version)"
    fi
    
    success "Kubernetes tools installed"
}

# Install project dependencies
install_project_dependencies() {
    info "Installing project dependencies"
    cd "${SCRIPT_DIR}"
    
    # Rust workspace dependencies
    if [[ -f "Cargo.toml" ]]; then
        info "Fetching Rust dependencies..."
        cargo fetch --locked
        info "Building Rust workspace..."
        cargo build --workspace
    fi
    
    # Node.js project dependencies
    local node_projects=(
        "SolConnectApp"
        "apps/solchat_mobile" 
        "encrypted-chat"
        "mobile/app"
    )
    
    for project in "${node_projects[@]}"; do
        if [[ -d "$project" && -f "$project/package.json" ]]; then
            info "Installing dependencies for $project..."
            cd "$project"
            
            if [[ -f "package-lock.json" ]]; then
                npm ci --cache "${CACHE_DIR}/npm" --prefer-offline
            elif [[ -f "yarn.lock" ]]; then
                yarn install --cache-folder "${CACHE_DIR}/yarn"
            else
                npm install --cache "${CACHE_DIR}/npm"
            fi
            
            cd "${SCRIPT_DIR}"
        fi
    done
    
    success "Project dependencies installed"
}

# Setup environment variables
setup_environment() {
    info "Configuring environment variables"
    
    # Create .env file with discovered variables
    cat > "${SCRIPT_DIR}/.env" << 'EOF'
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

# Development Settings
NODE_ENV=development
DEBUG=solconnect:*

# Cache Configuration
CARGO_HOME=./cache/cargo
NPM_CONFIG_CACHE=./cache/npm

# Placeholder for secrets (set these in your environment)
# SOLANA_PRIVATE_KEY=your_private_key_here
# WALLET_PRIVATE_KEY=your_wallet_private_key_here
EOF
    
    # Make environment variables available for current session
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
    
    success "Environment configured"
}

# Validate installation
validate_setup() {
    info "Validating installation..."
    
    local errors=0
    local required_commands=(git curl node npm rustc cargo solana)
    
    for cmd in "${required_commands[@]}"; do
        if command_exists "$cmd"; then
            info "✓ $cmd is available"
        else
            error "✗ $cmd is missing"
            ((errors++))
        fi
    done
    
    # Test project builds
    cd "${SCRIPT_DIR}"
    
    if [[ -f "Cargo.toml" ]]; then
        if cargo check --workspace --quiet; then
            info "✓ Rust workspace compiles"
        else
            error "✗ Rust workspace compilation failed"
            ((errors++))
        fi
    fi
    
    if [[ -d "SolConnectApp" ]]; then
        cd "SolConnectApp"
        if npm run tsc --if-present; then
            info "✓ TypeScript compilation successful"
        else
            error "✗ TypeScript compilation failed"
            ((errors++))
        fi
        cd "${SCRIPT_DIR}"
    fi
    
    if [[ $errors -eq 0 ]]; then
        success "All validations passed!"
        return 0
    else
        error "$errors validation(s) failed"
        return 1
    fi
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    info "Starting AI Agent setup for SolConnect repository"
    info "Log file: ${LOG_FILE}"
    
    # Initialize log
    echo "AI Agent Setup Log - $(date)" > "${LOG_FILE}"
    
    # Execute setup steps
    setup_directories
    install_system_packages
    install_rust
    install_nodejs
    install_solana_cli
    install_docker
    install_k8s_tools
    install_project_dependencies
    setup_environment
    
    # Validate everything works
    if validate_setup; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        success "Setup completed successfully in ${duration}s"
        
        info "Next steps:"
        info "1. Source environment: source .env"
        info "2. Start development: cd SolConnectApp && npm run dev"
        info "3. Start relay: cd SolConnectApp && npm run relay"
        info "4. Start validator: solana-test-validator --reset"
        
        return 0
    else
        error "Setup validation failed"
        return 1
    fi
}

# Handle interruption
trap 'error "Setup interrupted"; exit 130' INT TERM

# Run main function
main "$@"