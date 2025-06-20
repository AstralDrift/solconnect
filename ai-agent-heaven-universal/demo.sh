#!/usr/bin/env bash

# Universal AI Agent Heaven - Demonstration Script
# Shows cross-LLM portability in action

set -euo pipefail

readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly YELLOW='\033[1;33m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m'

echo -e "${WHITE}🌟 Universal AI Agent Heaven Framework Demo${NC}"
echo -e "${CYAN}Cross-LLM AI Development Workflows${NC}"
echo ""

# Demo 1: Universal Complexity Analysis
echo -e "${GREEN}📊 Demo 1: Universal Complexity Analysis${NC}"
echo "Analyzing the same task across all LLM platforms..."
echo ""

TASK="Add real-time chat with end-to-end encryption"

echo -e "${BLUE}Task:${NC} $TASK"
echo ""

if [[ -f "ai-agent-heaven-universal/core/analyzers/universal-complexity-analyzer.js" ]]; then
    echo -e "${CYAN}Running universal complexity analysis...${NC}"
    node ai-agent-heaven-universal/core/analyzers/universal-complexity-analyzer.js "$TASK" 2>/dev/null || {
        echo "Analysis would run with:"
        echo "- Multi-dimensional complexity scoring"
        echo "- LLM-specific strategy recommendations"
        echo "- Risk factor identification"
        echo "- Implementation time estimation"
    }
else
    echo "Would analyze: File complexity, Code complexity, Architecture, Domain-specific, Cross-cutting concerns"
    echo "Result: Complex task → Multi-agent coordination recommended"
fi

echo ""

# Demo 2: Platform-Specific Optimizations
echo -e "${GREEN}🤖 Demo 2: Platform-Specific Optimizations${NC}"
echo "Same task, different LLM approaches..."
echo ""

echo -e "${CYAN}Claude Approach:${NC}"
echo "✓ Parallel tool execution for comprehensive analysis"
echo "✓ Deep file analysis across multiple components simultaneously" 
echo "✓ Coordinated parallel development workflow"
echo "✓ Advanced architectural reasoning"

echo ""

echo -e "${CYAN}GPT-4 Approach:${NC}"
echo "✓ Conversational requirements clarification"
echo "✓ Iterative development with continuous feedback"
echo "✓ Natural dialogue about design decisions"
echo "✓ Step-by-step implementation with explanations"

echo ""

echo -e "${CYAN}Gemini Pro Approach:${NC}"
echo "✓ Large context analysis of entire codebase"
echo "✓ Planning-first comprehensive strategy"
echo "✓ Structured reasoning through implementation steps"
echo "✓ Analysis-heavy workflow with detailed documentation"

echo ""

echo -e "${CYAN}Local Model Approach:${NC}"
echo "✓ Resource-efficient template-driven development"
echo "✓ Simplified workflow breakdown"
echo "✓ Offline capability with essential features"
echo "✓ Focus on proven, straightforward solutions"

echo ""

# Demo 3: Cross-Platform Context Discovery
echo -e "${GREEN}🔍 Demo 3: Universal Context Discovery${NC}"
echo "Intelligent context gathering optimized for each platform..."
echo ""

if [[ -f "ai-agent-heaven-universal/platforms/claude/adapter.js" ]]; then
    echo -e "${CYAN}Running Claude context discovery...${NC}"
    node ai-agent-heaven-universal/platforms/claude/adapter.js discover-context "$TASK" 2>/dev/null | head -20 || {
        echo "Claude would discover:"
        echo "- Parallel analysis of project structure, relevant files, code patterns"
        echo "- Deep architectural integration point mapping"
        echo "- Comprehensive security and performance considerations"
    }
else
    echo "Claude: Parallel analysis of 15+ files, comprehensive pattern recognition"
fi

echo ""

if [[ -f "ai-agent-heaven-universal/platforms/gpt4/adapter.js" ]]; then
    echo -e "${CYAN}Running GPT-4 context discovery...${NC}"
    node ai-agent-heaven-universal/platforms/gpt4/adapter.js discover-context "$TASK" 2>/dev/null | head -20 || {
        echo "GPT-4 would discover:"
        echo "- Focused context with file previews and pattern implications"
        echo "- Conversational prompts for requirements clarification"
        echo "- Design discussion points and implementation questions"
    }
else
    echo "GPT-4: Focused analysis of 8 key files, conversational requirement gathering"
fi

echo ""

# Demo 4: Universal Setup
echo -e "${GREEN}⚙️  Demo 4: Universal Setup System${NC}"
echo "One setup script, any LLM platform..."
echo ""

echo -e "${CYAN}Setup Examples:${NC}"
echo ""

echo -e "${BLUE}# Setup for Claude with Next.js project${NC}"
echo "./setup.sh --platform claude --project-type web-app"
echo ""

echo -e "${BLUE}# Setup for GPT-4 with React Native${NC}"
echo "./setup.sh --platform gpt4 --project-type mobile-app --complexity complex"
echo ""

echo -e "${BLUE}# Setup for local Llama model${NC}"
echo "./setup.sh --platform local --model llama3 --project-type api-service"
echo ""

echo -e "${BLUE}# Auto-detect project and use Gemini${NC}"
echo "./setup.sh --platform gemini"
echo ""

# Demo 5: Universal Usage
echo -e "${GREEN}🚀 Demo 5: Universal Usage Patterns${NC}"
echo "Same commands, optimized execution per platform..."
echo ""

echo -e "${CYAN}Universal Commands:${NC}"
echo ""

echo -e "${BLUE}# Implement any feature${NC}"
echo "./agent --feature \"Add dark mode toggle\""
echo "→ Automatically optimizes approach based on configured platform"
echo ""

echo -e "${BLUE}# Discover context for any file${NC}"
echo "./agent --context \"src/components/Header.tsx\""
echo "→ Uses platform-specific context discovery patterns"
echo ""

echo -e "${BLUE}# Build knowledge graph${NC}"
echo "./agent --build-knowledge"
echo "→ Leverages each LLM's analytical strengths"
echo ""

# Demo 6: Quality Consistency
echo -e "${GREEN}✅ Demo 6: Quality Consistency${NC}"
echo "Same high standards across all platforms..."
echo ""

echo -e "${CYAN}Universal Quality Assurance:${NC}"
echo "✓ Standardized output formats (JSON, Markdown, YAML)"
echo "✓ Consistent error handling and graceful degradation"
echo "✓ Cross-LLM validation and testing patterns"
echo "✓ Performance benchmarking and metrics"
echo "✓ Security and best practice enforcement"

echo ""

# Summary
echo -e "${WHITE}🎉 Demo Complete!${NC}"
echo ""
echo -e "${GREEN}Key Benefits Demonstrated:${NC}"
echo "🔄 Platform Portability - Switch LLMs without changing workflows"
echo "⚡ Optimized Performance - Each LLM used to its strengths"  
echo "🎯 Consistent Quality - Same standards across all models"
echo "🚀 Developer Experience - Simple setup and intuitive usage"
echo "🔮 Future-Proof - Easy adaptation to new models"
echo ""

echo -e "${CYAN}Next Steps:${NC}"
echo "1. Choose your preferred LLM platform"
echo "2. Run the setup script for your project type"
echo "3. Start implementing features with optimized workflows"
echo "4. Enjoy consistent, high-quality AI development assistance"
echo ""

echo -e "${WHITE}Universal AI Agent Heaven: Because great development workflows shouldn't be limited by LLM choice.${NC}" 