#!/usr/bin/env bash

# Universal AI Agent Heaven Setup Script
# Configures the framework for any LLM platform (Claude, GPT-4, Gemini, Local models)

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(pwd)"
readonly LOG_FILE="${PROJECT_ROOT}/ai-agent-heaven-setup.log"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m' # No Color

# Global variables
PLATFORM=""
MODEL=""
PROJECT_TYPE=""
COMPLEXITY_LEVEL="medium"
DRY_RUN=false
VERBOSE=false

# Logging functions
log() {
    echo -e "${WHITE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "${LOG_FILE}"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $*" | tee -a "${LOG_FILE}"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "${LOG_FILE}" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "${LOG_FILE}"
}

debug() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${PURPLE}[DEBUG]${NC} $*" | tee -a "${LOG_FILE}"
    fi
}

# Help function
show_help() {
    cat << EOF
${WHITE}Universal AI Agent Heaven Setup${NC}

${CYAN}USAGE:${NC}
    $0 --platform <platform> [options]

${CYAN}PLATFORMS:${NC}
    ${GREEN}claude${NC}     - Optimize for Claude (Cursor, IDE integrations)
    ${GREEN}gpt4${NC}       - Optimize for GPT-4 (ChatGPT, API integrations)  
    ${GREEN}gemini${NC}     - Optimize for Gemini Pro
    ${GREEN}local${NC}      - Optimize for local models (Ollama, LMStudio)

${CYAN}OPTIONS:${NC}
    --model <model>         Specific model (e.g., llama3, codellama)
    --project-type <type>   Project type (web-app, mobile-app, api-service, blockchain)
    --complexity <level>    Complexity level (simple, medium, complex)
    --dry-run              Show what would be done without making changes
    --verbose              Enable verbose output
    --help, -h             Show this help message

${CYAN}EXAMPLES:${NC}
    # Setup for Claude with Next.js project
    $0 --platform claude --project-type web-app

    # Setup for GPT-4 with mobile development
    $0 --platform gpt4 --project-type mobile-app --complexity complex

    # Setup for local Llama model
    $0 --platform local --model llama3 --project-type api-service

    # Dry run to see what would be configured
    $0 --platform gemini --dry-run

${CYAN}PROJECT TYPES:${NC}
    ${GREEN}web-app${NC}      - React, Next.js, Vue, Angular applications
    ${GREEN}mobile-app${NC}   - React Native, Flutter, native apps
    ${GREEN}api-service${NC}  - Node.js, Python, Rust backend services
    ${GREEN}blockchain${NC}   - Smart contracts, DeFi, Web3 applications

EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --platform)
                PLATFORM="$2"
                shift 2
                ;;
            --model)
                MODEL="$2"
                shift 2
                ;;
            --project-type)
                PROJECT_TYPE="$2"
                shift 2
                ;;
            --complexity)
                COMPLEXITY_LEVEL="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Validate required arguments
    if [[ -z "$PLATFORM" ]]; then
        error "Platform is required. Use --platform <platform>"
        show_help
        exit 1
    fi

    # Validate platform
    case "$PLATFORM" in
        claude|gpt4|gemini|local)
            ;;
        *)
            error "Invalid platform: $PLATFORM"
            error "Valid platforms: claude, gpt4, gemini, local"
            exit 1
            ;;
    esac

    # Auto-detect project type if not specified
    if [[ -z "$PROJECT_TYPE" ]]; then
        PROJECT_TYPE=$(detect_project_type)
        info "Auto-detected project type: $PROJECT_TYPE"
    fi
}

# Detect project type from existing files
detect_project_type() {
    if [[ -f "package.json" ]]; then
        if [[ -f "next.config.js" ]] || [[ -f "next.config.ts" ]]; then
            echo "web-app"
        elif grep -q "react-native" package.json 2>/dev/null; then
            echo "mobile-app"
        elif grep -q "express\|fastify\|koa" package.json 2>/dev/null; then
            echo "api-service"
        elif grep -q "@solana\|@ethereum\|web3" package.json 2>/dev/null; then
            echo "blockchain"
        else
            echo "web-app"
        fi
    elif [[ -f "Cargo.toml" ]]; then
        if grep -q "solana\|anchor" Cargo.toml 2>/dev/null; then
            echo "blockchain"
        else
            echo "api-service"
        fi
    elif [[ -f "requirements.txt" ]] || [[ -f "pyproject.toml" ]]; then
        echo "api-service"
    else
        echo "web-app"
    fi
}

# Setup directories and basic structure
setup_directories() {
    info "Setting up directory structure..."
    
    local dirs=(
        ".ai-agent-heaven"
        ".ai-agent-heaven/cache"
        ".ai-agent-heaven/config"
        ".ai-agent-heaven/templates"
        ".ai-agent-heaven/workflows"
        ".ai-agent-heaven/knowledge"
    )

    for dir in "${dirs[@]}"; do
        if [[ "$DRY_RUN" == true ]]; then
            debug "Would create directory: $dir"
        else
            mkdir -p "$dir"
            debug "Created directory: $dir"
        fi
    done

    success "Directory structure ready"
}

# Install Node.js dependencies for the framework
install_dependencies() {
    info "Installing Universal AI Agent Heaven dependencies..."
    
    if [[ "$DRY_RUN" == true ]]; then
        debug "Would install: js-yaml for YAML processing"
        return
    fi

    # Check if Node.js is available
    if ! command -v node >/dev/null 2>&1; then
        warn "Node.js not found. Some features may not work."
        return
    fi

    # Install minimal dependencies for the framework
    local deps=("js-yaml")
    for dep in "${deps[@]}"; do
        if ! npm list "$dep" >/dev/null 2>&1; then
            debug "Installing $dep..."
            npm install "$dep" --save-dev >/dev/null 2>&1 || warn "Failed to install $dep"
        fi
    done
}

# Configure platform-specific settings
configure_platform() {
    info "Configuring for platform: $PLATFORM"
    
    case "$PLATFORM" in
        claude)
            configure_claude
            ;;
        gpt4)
            configure_gpt4
            ;;
        gemini)
            configure_gemini
            ;;
        local)
            configure_local
            ;;
    esac
}

# Claude-specific configuration
configure_claude() {
    info "Setting up Claude optimizations..."
    
    local config_file=".ai-agent-heaven/config/claude.json"
    local claude_config=$(cat << EOF
{
  "platform": "claude",
  "optimizations": {
    "useParallelExecution": true,
    "maxContextSize": 200000,
    "preferComprehensiveAnalysis": true,
    "enableDeepFileAnalysis": true,
    "parallelToolExecution": true
  },
  "features": [
    "parallel_tool_execution",
    "comprehensive_analysis", 
    "architectural_reasoning",
    "advanced_error_handling"
  ],
  "workflows": {
    "simple": "parallel-single-agent",
    "medium": "parallel-guided-implementation",
    "complex": "coordinated-parallel-development"
  },
  "projectType": "$PROJECT_TYPE",
  "complexityLevel": "$COMPLEXITY_LEVEL"
}
EOF
    )

    if [[ "$DRY_RUN" == true ]]; then
        debug "Would create Claude config:"
        debug "$claude_config"
    else
        echo "$claude_config" > "$config_file"
        debug "Created Claude configuration: $config_file"
    fi

    # Create Claude-specific commands
    create_claude_commands
}

# GPT-4 specific configuration  
configure_gpt4() {
    info "Setting up GPT-4 optimizations..."
    
    local config_file=".ai-agent-heaven/config/gpt4.json"
    local gpt4_config=$(cat << EOF
{
  "platform": "gpt4",
  "optimizations": {
    "useIterativeDevelopment": true,
    "maxTokens": 128000,
    "preferDialogueDriven": true,
    "enableConversationalFlow": true,
    "focusOnCodeGeneration": true
  },
  "features": [
    "natural_dialogue",
    "code_generation",
    "iterative_refinement",
    "pattern_recognition"
  ],
  "workflows": {
    "simple": "conversational-single-step",
    "medium": "iterative-guided-development", 
    "complex": "collaborative-incremental-development"
  },
  "projectType": "$PROJECT_TYPE",
  "complexityLevel": "$COMPLEXITY_LEVEL"
}
EOF
    )

    if [[ "$DRY_RUN" == true ]]; then
        debug "Would create GPT-4 config:"
        debug "$gpt4_config"
    else
        echo "$gpt4_config" > "$config_file"
        debug "Created GPT-4 configuration: $config_file"
    fi

    create_gpt4_commands
}

# Gemini-specific configuration
configure_gemini() {
    info "Setting up Gemini Pro optimizations..."
    
    local config_file=".ai-agent-heaven/config/gemini.json"
    local gemini_config=$(cat << EOF
{
  "platform": "gemini",
  "optimizations": {
    "useLargeContext": true,
    "maxTokens": 1000000,
    "preferPlanningFirst": true,
    "enableStructuredReasoning": true,
    "focusOnAnalysis": true
  },
  "features": [
    "large_context_processing",
    "comprehensive_planning",
    "structured_reasoning",
    "detailed_analysis"
  ],
  "workflows": {
    "simple": "planning-first-simple",
    "medium": "analysis-heavy-development",
    "complex": "comprehensive-system-analysis"
  },
  "projectType": "$PROJECT_TYPE",
  "complexityLevel": "$COMPLEXITY_LEVEL"
}
EOF
    )

    if [[ "$DRY_RUN" == true ]]; then
        debug "Would create Gemini config:"
        debug "$gemini_config"
    else
        echo "$gemini_config" > "$config_file"
        debug "Created Gemini configuration: $config_file"
    fi

    create_gemini_commands
}

# Local model configuration
configure_local() {
    info "Setting up local model optimizations..."
    
    local config_file=".ai-agent-heaven/config/local.json"
    local local_config=$(cat << EOF
{
  "platform": "local",
  "model": "${MODEL:-llama3}",
  "optimizations": {
    "useResourceEfficiency": true,
    "maxTokens": 32000,
    "preferSimpleWorkflows": true,
    "enableTemplateGuided": true,
    "focusOnEssentials": true
  },
  "features": [
    "resource_efficiency",
    "template_guidance",
    "simple_workflows",
    "offline_capability"
  ],
  "workflows": {
    "simple": "template-guided-simple",
    "medium": "step-by-step-development",
    "complex": "simplified-breakdown"
  },
  "projectType": "$PROJECT_TYPE",
  "complexityLevel": "$COMPLEXITY_LEVEL"
}
EOF
    )

    if [[ "$DRY_RUN" == true ]]; then
        debug "Would create local model config:"
        debug "$local_config"
    else
        echo "$local_config" > "$config_file"
        debug "Created local model configuration: $config_file"
    fi

    create_local_commands
}

# Create platform-specific command files
create_claude_commands() {
    local commands_dir=".ai-agent-heaven/commands"
    mkdir -p "$commands_dir"
    
    if [[ "$DRY_RUN" == true ]]; then
        debug "Would create Claude commands in $commands_dir"
        return
    fi

    # Context discovery command
    cat > "$commands_dir/discover-context.sh" << 'EOF'
#!/bin/bash
# Claude Context Discovery - Parallel Analysis
echo "🔍 Discovering context with Claude parallel analysis..."
node ai-agent-heaven-universal/platforms/claude/adapter.js discover-context "$1"
EOF

    # Feature implementation command
    cat > "$commands_dir/implement-feature.sh" << 'EOF'
#!/bin/bash
# Claude Feature Implementation - Parallel Execution
echo "🚀 Implementing feature with Claude parallel execution..."
node ai-agent-heaven-universal/platforms/claude/adapter.js implement-feature "$1" --parallel
EOF

    chmod +x "$commands_dir"/*.sh
    debug "Created Claude commands"
}

create_gpt4_commands() {
    local commands_dir=".ai-agent-heaven/commands"
    mkdir -p "$commands_dir"
    
    if [[ "$DRY_RUN" == true ]]; then
        debug "Would create GPT-4 commands in $commands_dir"
        return
    fi

    # Conversational implementation
    cat > "$commands_dir/implement-conversational.sh" << 'EOF'
#!/bin/bash
# GPT-4 Conversational Implementation
echo "💬 Starting conversational implementation with GPT-4..."
node ai-agent-heaven-universal/platforms/gpt4/adapter.js start-conversation "$1"
EOF

    # Iterative development
    cat > "$commands_dir/develop-iteratively.sh" << 'EOF'
#!/bin/bash
# GPT-4 Iterative Development
echo "🔄 Beginning iterative development with GPT-4..."
node ai-agent-heaven-universal/platforms/gpt4/adapter.js implement-iteratively "$1"
EOF

    chmod +x "$commands_dir"/*.sh
    debug "Created GPT-4 commands"
}

create_gemini_commands() {
    local commands_dir=".ai-agent-heaven/commands"
    mkdir -p "$commands_dir"
    
    if [[ "$DRY_RUN" == true ]]; then
        debug "Would create Gemini commands in $commands_dir"
        return
    fi

    # Planning-first approach
    cat > "$commands_dir/plan-first.sh" << 'EOF'
#!/bin/bash
# Gemini Planning-First Development
echo "📋 Starting planning-first development with Gemini..."
node ai-agent-heaven-universal/platforms/gemini/adapter.js plan-first "$1"
EOF

    chmod +x "$commands_dir"/*.sh
    debug "Created Gemini commands"
}

create_local_commands() {
    local commands_dir=".ai-agent-heaven/commands"
    mkdir -p "$commands_dir"
    
    if [[ "$DRY_RUN" == true ]]; then
        debug "Would create local model commands in $commands_dir"
        return
    fi

    # Simple implementation
    cat > "$commands_dir/implement-simple.sh" << 'EOF'  
#!/bin/bash
# Local Model Simple Implementation
echo "🏠 Starting simple implementation with local model..."
node ai-agent-heaven-universal/platforms/local/adapter.js implement-simple "$1"
EOF

    chmod +x "$commands_dir"/*.sh
    debug "Created local model commands"
}

# Create universal agent script
create_agent_script() {
    info "Creating universal agent script..."
    
    local agent_script="./agent"
    
    if [[ "$DRY_RUN" == true ]]; then
        debug "Would create agent script: $agent_script"
        return
    fi

    cat > "$agent_script" << EOF
#!/usr/bin/env bash

# Universal AI Agent Heaven Entry Point
# Platform: $PLATFORM
# Project Type: $PROJECT_TYPE

set -euo pipefail

readonly PLATFORM="$PLATFORM"
readonly PROJECT_TYPE="$PROJECT_TYPE" 
readonly COMPLEXITY_LEVEL="$COMPLEXITY_LEVEL"

# Load platform configuration
if [[ -f ".ai-agent-heaven/config/\${PLATFORM}.json" ]]; then
    CONFIG_FILE=".ai-agent-heaven/config/\${PLATFORM}.json"
else
    echo "Error: Platform configuration not found"
    exit 1
fi

# Parse command
COMMAND="\$1"
shift

case "\$COMMAND" in
    --feature)
        echo "🚀 Implementing feature: \$1"
        node ai-agent-heaven-universal/core/analyzers/universal-complexity-analyzer.js "\$1"
        node ai-agent-heaven-universal/platforms/\${PLATFORM}/adapter.js discover-context "\$1"
        ;;
    --context)
        echo "🔍 Discovering context for: \$1"
        node ai-agent-heaven-universal/platforms/\${PLATFORM}/adapter.js discover-context "\$1"
        ;;
    --build-knowledge)
        echo "🧠 Building knowledge graph..."
        node ai-agent-heaven-universal/core/analyzers/universal-complexity-analyzer.js "build knowledge graph"
        ;;
    --help)
        echo "Universal AI Agent Heaven - Platform: \$PLATFORM"
        echo ""
        echo "Usage: ./agent <command> [args]"
        echo ""
        echo "Commands:"
        echo "  --feature <description>     Implement a new feature"
        echo "  --context <target>          Discover context for target"
        echo "  --build-knowledge          Build project knowledge graph"
        echo "  --help                     Show this help"
        ;;
    *)
        echo "Unknown command: \$COMMAND"
        echo "Use ./agent --help for available commands"
        exit 1
        ;;
esac
EOF

    chmod +x "$agent_script"
    success "Created universal agent script: $agent_script"
}

# Create documentation
create_documentation() {
    info "Creating platform-specific documentation..."
    
    local docs_dir=".ai-agent-heaven/docs"
    mkdir -p "$docs_dir"
    
    if [[ "$DRY_RUN" == true ]]; then
        debug "Would create documentation in $docs_dir"
        return
    fi

    # Platform-specific README
    cat > "$docs_dir/README-$PLATFORM.md" << EOF
# AI Agent Heaven - $PLATFORM Configuration

## Platform: $PLATFORM
## Project Type: $PROJECT_TYPE  
## Complexity Level: $COMPLEXITY_LEVEL

## Quick Start

\`\`\`bash
# Implement a feature
./agent --feature "Add user authentication"

# Discover context
./agent --context "src/components/LoginForm.tsx"

# Build knowledge graph
./agent --build-knowledge
\`\`\`

## Platform-Specific Features

EOF

    case "$PLATFORM" in
        claude)
            cat >> "$docs_dir/README-$PLATFORM.md" << 'EOF'
### Claude Optimizations
- **Parallel tool execution** for maximum efficiency
- **Deep file analysis** with comprehensive context
- **Advanced reasoning** for complex architectural decisions
- **Specialized commands** for development workflows

### Available Commands
- `discover-context.sh` - Parallel context discovery
- `implement-feature.sh` - Parallel feature implementation

EOF
            ;;
        gpt4)
            cat >> "$docs_dir/README-$PLATFORM.md" << 'EOF'
### GPT-4 Optimizations
- **Conversational development** with natural dialogue
- **Iterative refinement** and step-by-step implementation
- **Code generation excellence** with best practices
- **Requirements clarification** through dialogue

### Available Commands
- `implement-conversational.sh` - Conversational implementation
- `develop-iteratively.sh` - Iterative development

EOF
            ;;
    esac

    debug "Created platform documentation"
}

# Validate installation
validate_installation() {
    info "Validating installation..."
    
    local errors=0
    
    # Check directories
    local required_dirs=(
        ".ai-agent-heaven"
        ".ai-agent-heaven/config"
        ".ai-agent-heaven/commands"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ -d "$dir" ]] || [[ "$DRY_RUN" == true ]]; then
            debug "✓ $dir exists"
        else
            error "✗ $dir missing"
            ((errors++))
        fi
    done
    
    # Check configuration file
    local config_file=".ai-agent-heaven/config/$PLATFORM.json"
    if [[ -f "$config_file" ]] || [[ "$DRY_RUN" == true ]]; then
        debug "✓ Platform configuration exists"
    else
        error "✗ Platform configuration missing"
        ((errors++))
    fi
    
    # Check agent script
    if [[ -f "./agent" ]] || [[ "$DRY_RUN" == true ]]; then
        debug "✓ Universal agent script exists"
    else
        error "✗ Universal agent script missing"
        ((errors++))
    fi
    
    if [[ $errors -eq 0 ]]; then
        success "Installation validation passed"
        return 0
    else
        error "$errors validation errors found"
        return 1
    fi
}

# Display completion message
show_completion() {
    echo ""
    echo -e "${GREEN}🎉 Universal AI Agent Heaven Setup Complete!${NC}"
    echo ""
    echo -e "${CYAN}Configuration:${NC}"
    echo -e "  Platform: ${GREEN}$PLATFORM${NC}"
    echo -e "  Project Type: ${GREEN}$PROJECT_TYPE${NC}"
    echo -e "  Complexity: ${GREEN}$COMPLEXITY_LEVEL${NC}"
    if [[ -n "$MODEL" ]]; then
        echo -e "  Model: ${GREEN}$MODEL${NC}"
    fi
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo -e "  ${WHITE}1.${NC} Try implementing a feature:"
    echo -e "     ${BLUE}./agent --feature \"Add user authentication\"${NC}"
    echo ""
    echo -e "  ${WHITE}2.${NC} Discover context for existing code:"
    echo -e "     ${BLUE}./agent --context \"src/components/Header.tsx\"${NC}"
    echo ""
    echo -e "  ${WHITE}3.${NC} Build project knowledge graph:"
    echo -e "     ${BLUE}./agent --build-knowledge${NC}"
    echo ""
    echo -e "${CYAN}Documentation:${NC}"
    echo -e "  Platform guide: ${BLUE}.ai-agent-heaven/docs/README-$PLATFORM.md${NC}"
    echo -e "  Configuration: ${BLUE}.ai-agent-heaven/config/$PLATFORM.json${NC}"
    echo ""
    echo -e "${GREEN}Happy coding with AI Agent Heaven! 🚀${NC}"
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}           Universal AI Agent Heaven Setup                        ${NC}"
    echo -e "${PURPLE}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Initialize log
    echo "Universal AI Agent Heaven Setup - $(date)" > "$LOG_FILE"
    
    info "Starting setup process..."
    
    # Execute setup steps
    setup_directories
    install_dependencies
    configure_platform
    create_agent_script
    create_documentation
    
    # Validate installation
    if validate_installation; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        if [[ "$DRY_RUN" == true ]]; then
            success "Dry run completed successfully in ${duration}s"
            info "No changes were made. Remove --dry-run to apply configuration."
        else
            success "Setup completed successfully in ${duration}s"
            show_completion
        fi
        
        return 0
    else
        error "Setup validation failed"
        return 1
    fi
}

# Handle interruption
trap 'error "Setup interrupted"; exit 130' INT TERM

# Parse arguments and run main function
parse_arguments "$@"
main 