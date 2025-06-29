# ⚙️ AI Agent Setup Guide

> **Platform-Specific Optimization**: This guide provides detailed setup instructions for different AI platforms to maximize your effectiveness with the SolConnect codebase.

## 🎯 Quick Platform Selection

### 💡 **Claude (Recommended for SolConnect)**
- **Best for**: Parallel analysis, comprehensive context handling, tool-based development
- **Strength**: Excels at the complex crypto/protocol work in SolConnect
- **Setup Time**: 5 minutes

### 🧠 **GPT-4** 
- **Best for**: Natural conversation, iterative development, code generation
- **Strength**: Great for UI work and conversational debugging
- **Setup Time**: 10 minutes

### 🔍 **Gemini Pro**
- **Best for**: Large codebase analysis, planning, structured reasoning
- **Strength**: Excellent for architecture analysis and refactoring
- **Setup Time**: 15 minutes

### 💻 **Local Models (Ollama/LMStudio)**
- **Best for**: Privacy-conscious development, offline work
- **Strength**: Good for focused, specific tasks
- **Setup Time**: 20 minutes

---

## 🤖 Claude Setup (Recommended)

### Prerequisites
- Cursor IDE, Claude Code, or API access
- Git access to the repository
- Basic understanding of TypeScript/Rust

### Step 1: Repository Initialization
```bash
# Clone if you haven't already
git clone https://github.com/micahoates/SolConnect.git
cd SolConnect

# Initialize the AI agent system for Claude
./ai-agent-heaven-universal/setup.sh --platform claude
```

### Step 2: Context Optimization
```bash
# Build context index for faster access
./ai-agent-heaven-universal/tools/context-builder.sh --full-analysis

# Set your specialization (choose one)
./ai-agent-heaven-universal/tools/context-builder.sh --specialization crypto    # For encryption/security work
./ai-agent-heaven-universal/tools/context-builder.sh --specialization ui       # For React/mobile UI work  
./ai-agent-heaven-universal/tools/context-builder.sh --specialization storage  # For database/storage work
./ai-agent-heaven-universal/tools/context-builder.sh --specialization network  # For relay/transport work
./ai-agent-heaven-universal/tools/context-builder.sh --specialization fullstack # For full-stack development
```

### Step 3: Claude-Specific Optimizations

#### Enable Parallel Tool Execution
Claude excels at running multiple tools simultaneously. Add this to your context:

```markdown
## Claude Optimization Instructions

When working on SolConnect:

1. **Use Parallel Analysis**: Run multiple file reads, searches, and git operations simultaneously
2. **Leverage Context Breadth**: Read comprehensive context upfront rather than incrementally
3. **Tool-First Approach**: Use tools extensively for code analysis, testing, and validation
4. **Comprehensive Testing**: Generate full test suites covering all edge cases
```

#### SolConnect-Specific Context Priorities
```bash
# High Priority Files for Claude Context
export CLAUDE_PRIORITY_FILES="
CLAUDE.md
docs/AI_AGENT_GUIDE.md
src/services/SolConnectSDK.ts
src/services/MessageBus.ts
src/services/crypto/SignalProtocol.ts
src/services/transport/MessageTransport.ts
"

# Development Tools Optimization
export CLAUDE_TOOLS="crypto-analyzer,security-scanner,component-analyzer,performance-profiler"
```

### Step 4: Validate Setup
```bash
# Test the AI agent system
./ai-agent-heaven-universal/agent --test-setup

# Should output:
# ✅ Claude platform detected
# ✅ SolConnect context loaded
# ✅ Crypto specialization patterns available
# ✅ Parallel tool execution enabled
# ✅ Repository optimization complete
```

---

## 🔮 GPT-4 Setup

### Prerequisites  
- ChatGPT Plus, API access, or GPT-4 integration
- Repository access
- Understanding of iterative development

### Step 1: Repository Setup
```bash
cd SolConnect
./ai-agent-heaven-universal/setup.sh --platform gpt4
```

### Step 2: GPT-4 Context Configuration
```bash
# Configure for iterative development
./ai-agent-heaven-universal/tools/context-builder.sh --optimize-for gpt4

# Enable conversation continuity
echo "gpt4_session_continuity=true" >> .ai-agent-config
```

### Step 3: GPT-4 Prompt Optimization

#### Custom System Prompt for SolConnect
```markdown
# SolConnect GPT-4 Assistant

You are an expert developer working on SolConnect, a decentralized messaging app built on Solana with advanced AI agent integration.

## Your Strengths in This Codebase:
- Natural language requirement analysis
- Iterative feature development  
- Conversational debugging and problem-solving
- Clean, readable code generation
- User experience optimization

## SolConnect Context:
- **Tech Stack**: TypeScript, React, React Native, Rust, Solana
- **Key Features**: End-to-end encryption, wallet-based identity, real-time messaging
- **AI Integration**: Universal AI Agent Heaven framework with self-improving systems

## Development Approach:
1. Ask clarifying questions when requirements are unclear
2. Implement features incrementally with validation at each step
3. Focus on user experience and code readability
4. Explain your reasoning and design decisions
5. Provide multiple approaches when appropriate

## Current Priority Areas:
- Message encryption and security features
- React/React Native UI components
- WebSocket transport optimization
- Mobile user experience improvements
```

### Step 4: Workflow Configuration
```bash
# Enable GPT-4 iterative workflow
./ai-agent-heaven-universal/tools/workflow-engine.sh --workflow iterative-development --platform gpt4

# Set up validation checkpoints
echo "gpt4_validation_checkpoints=true" >> .ai-agent-config
echo "gpt4_explanation_level=detailed" >> .ai-agent-config
```

---

## 🔍 Gemini Pro Setup

### Prerequisites
- Gemini Pro API access
- Large context window capability
- Structured analysis preferences

### Step 1: Repository Analysis
```bash
cd SolConnect
./ai-agent-heaven-universal/setup.sh --platform gemini

# Enable large context analysis
./ai-agent-heaven-universal/tools/context-builder.sh --full-codebase-analysis
```

### Step 2: Gemini Optimization
```bash
# Configure for comprehensive analysis
echo "gemini_context_window=large" >> .ai-agent-config
echo "gemini_analysis_depth=comprehensive" >> .ai-agent-config
echo "gemini_planning_first=true" >> .ai-agent-config
```

### Step 3: Structured Analysis Setup

#### Gemini-Optimized Prompt Template
```markdown
# SolConnect Gemini Pro Assistant

You are a Gemini Pro agent specialized in large-scale codebase analysis and architectural planning for SolConnect.

## Your Approach:
1. **Comprehensive Analysis**: Process the entire codebase context when making decisions
2. **Structured Planning**: Create detailed implementation plans before coding
3. **System-Wide Thinking**: Consider impacts across all system components
4. **Documentation-First**: Document architectural decisions and trade-offs

## SolConnect Architecture Understanding:
- Multi-platform messaging app (Web + Mobile)
- Rust-based crypto core with TypeScript frontend
- WebSocket relay with Solana blockchain integration
- AI agent framework with self-improving documentation

## Analysis Priorities:
1. System architecture and component relationships
2. Data flow and state management patterns
3. Security implications and crypto implementations
4. Performance characteristics and optimization opportunities
5. Cross-platform compatibility considerations
```

---

## 💻 Local Models Setup (Ollama/LMStudio)

### Prerequisites
- Ollama or LMStudio installed
- Local model downloaded (CodeLlama, Llama-3, etc.)
- Understanding of resource constraints

### Step 1: Local Environment Setup
```bash
cd SolConnect

# Setup for resource-efficient operation
./ai-agent-heaven-universal/setup.sh --platform local --model llama3

# Configure for lightweight operation
echo "local_context_limit=8000" >> .ai-agent-config
echo "local_complexity=simple" >> .ai-agent-config
echo "local_batch_size=small" >> .ai-agent-config
```

### Step 2: Model-Specific Configuration

#### For CodeLlama
```bash
./ai-agent-heaven-universal/setup.sh --platform local --model codellama
echo "local_specialization=code_generation" >> .ai-agent-config
```

#### For Llama-3
```bash  
./ai-agent-heaven-universal/setup.sh --platform local --model llama3
echo "local_specialization=general_development" >> .ai-agent-config
```

### Step 3: Efficiency Optimizations
```bash
# Enable template-driven development
./ai-agent-heaven-universal/tools/template-engine.sh --enable-local-templates

# Configure for focused tasks
echo "local_task_focus=single" >> .ai-agent-config
echo "local_explanation_level=concise" >> .ai-agent-config
```

---

## 🔧 Universal Configuration

### Environment Variables
Create `.ai-agent-config` in the repository root:

```bash
# Platform Configuration
AI_PLATFORM=claude  # or gpt4, gemini, local
AI_SPECIALIZATION=crypto  # or ui, storage, network, fullstack

# SolConnect Specific
SOLCONNECT_CONTEXT_PRIORITY=high
SOLCONNECT_CRYPTO_FOCUS=true
SOLCONNECT_MOBILE_OPTIMIZATION=true

# Performance Tuning
CONTEXT_CACHE_ENABLED=true
PARALLEL_ANALYSIS=true  # Claude only
INCREMENTAL_LOADING=false  # GPT-4/Gemini only
TEMPLATE_MODE=false  # Local models only
```

### Repository-Specific Aliases
Add to your shell profile:

```bash
# SolConnect AI Development Aliases
alias sc-agent='./ai-agent-heaven-universal/agent'
alias sc-context='./ai-agent-heaven-universal/tools/context-builder.sh'
alias sc-analyze='./ai-agent-heaven-universal/tools/codebase-analyzer.sh'
alias sc-patterns='./ai-agent-heaven-universal/tools/pattern-viewer.sh'
alias sc-metrics='./ai-agent-heaven-universal/tools/metrics-dashboard.sh'
```

## 🧪 Testing Your Setup

### Validation Commands
```bash
# Test basic functionality
sc-agent --test-basic

# Test context loading
sc-context --test-load

# Test specialization detection
sc-agent --test-specialization

# Test platform optimization
sc-agent --test-platform-features
```

### Expected Output
```
✅ AI Agent Heaven Framework: Loaded
✅ Platform: Claude (optimized)
✅ SolConnect Context: 847 files indexed
✅ Specialization: Crypto (patterns loaded)
✅ Tools Available: 12 crypto-specific tools
✅ Self-Improving Systems: Active
✅ Pattern Library: 156 patterns loaded
✅ Performance Optimization: Enabled
```

## 🚀 Quick Start Commands

### First Steps After Setup
```bash
# Get oriented in the codebase
sc-agent --explore "What are the main components?"

# Understand the crypto architecture  
sc-agent --analyze "src/services/crypto/"

# See available patterns for your specialization
sc-patterns --list --specialization crypto

# Start your first AI-assisted task
sc-agent --feature "Add message read receipts"
```

## 🔄 Regular Maintenance

### Weekly Updates
```bash
# Update pattern library
sc-agent --update-patterns

# Refresh context index
sc-context --rebuild-index

# Update performance metrics
sc-metrics --update-baseline
```

### Monthly Optimization
```bash
# Analyze agent performance
sc-agent --performance-report

# Update platform-specific optimizations
./ai-agent-heaven-universal/setup.sh --platform YOUR_PLATFORM --update

# Review and update specialization
sc-agent --review-specialization
```

---

## 🆘 Troubleshooting

### Common Issues

#### "Context loading is slow"
```bash
# Enable context caching
echo "CONTEXT_CACHE_ENABLED=true" >> .ai-agent-config

# Reduce context scope for testing
sc-context --scope minimal
```

#### "Pattern recommendations seem off"
```bash
# Reset pattern library
sc-patterns --reset

# Rebuild with current codebase
sc-patterns --rebuild --analyze-recent-changes
```

#### "Platform features not working"
```bash
# Verify platform detection
sc-agent --detect-platform

# Reconfigure platform-specific features
./ai-agent-heaven-universal/setup.sh --platform YOUR_PLATFORM --force-reconfigure
```

### Getting Help
- Check `docs/AI_AGENT_GUIDE.md` for general guidance
- Review `docs/INTELLIGENCE_SYSTEMS.md` for advanced features  
- Look at `.claude/intelligence/` for system documentation
- Use `sc-agent --help` for command reference

---

**🎯 Success Metric**: After setup, you should be able to ask complex questions about the codebase and get intelligent, context-aware responses that help you develop more effectively than you could alone.