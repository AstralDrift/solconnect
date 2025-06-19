#!/bin/bash

# Context System Demo Script
# Demonstrates all features of the enhanced context management system

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTEXT_DIR="$BASE_DIR/.context"

echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${PURPLE}       🤖 Enhanced Context Management System Demo${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to pause and wait for user
pause() {
    echo ""
    echo -e "${CYAN}Press Enter to continue...${NC}"
    read -r
}

# 1. Generate Context
echo -e "${BLUE}📋 Step 1: Generating Comprehensive Context${NC}"
echo -e "${YELLOW}This creates both general and Claude-specific context files${NC}"
echo ""
sleep 1
"$CONTEXT_DIR/scripts/generate-context.sh"
pause

# 2. Show Claude Context
echo -e "${BLUE}🤖 Step 2: Claude-Specific Context${NC}"
echo -e "${YELLOW}Let's look at the Claude-optimized context:${NC}"
echo ""
head -30 "$CONTEXT_DIR/CLAUDE_CONTEXT.md"
echo -e "${CYAN}... (truncated for demo)${NC}"
pause

# 3. Code Health Check
echo -e "${BLUE}🏥 Step 3: Code Health Analysis${NC}"
echo -e "${YELLOW}Running comprehensive health check...${NC}"
echo ""
sleep 1
"$CONTEXT_DIR/scripts/code-health-check.sh"
pause

# 4. Dependency Analysis
echo -e "${BLUE}📦 Step 4: Dependency Analysis${NC}"
echo -e "${YELLOW}Analyzing project dependencies...${NC}"
echo ""
sleep 1
"$CONTEXT_DIR/scripts/analyze-dependencies.sh"
echo ""
echo -e "${GREEN}✓ Full report saved to: .context/dependency-analysis.md${NC}"
pause

# 5. Subsystem Analysis Demo
echo -e "${BLUE}🔍 Step 5: Subsystem Deep Dive${NC}"
echo -e "${YELLOW}Let's analyze the 'services' subsystem:${NC}"
echo ""
sleep 1
"$CONTEXT_DIR/scripts/analyze-subsystem.sh" services
pause

# 6. Find Related Files Demo
echo -e "${BLUE}🔗 Step 6: Finding Related Files${NC}"
echo -e "${YELLOW}Let's find all files related to 'MessageBus':${NC}"
echo ""
sleep 1
"$CONTEXT_DIR/scripts/find-related.sh" MessageBus
pause

# 7. Summary
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Demo Complete!${NC}"
echo ""
echo -e "${BLUE}📊 Generated Files:${NC}"
echo -e "  • ${YELLOW}CONTEXT_SUMMARY.md${NC} - Comprehensive project summary"
echo -e "  • ${YELLOW}CLAUDE_CONTEXT.md${NC} - AI-optimized context"
echo -e "  • ${YELLOW}code-health-report.md${NC} - Health metrics and score"
echo -e "  • ${YELLOW}dependency-analysis.md${NC} - Dependency insights"
echo -e "  • ${YELLOW}subsystem-services.md${NC} - Services analysis"
echo -e "  • ${YELLOW}related-MessageBus.md${NC} - MessageBus relationships"
echo ""
echo -e "${BLUE}🚀 Quick Commands:${NC}"
echo -e "  ${CYAN}cat .context/CONTEXT_SUMMARY.md${NC} - View main summary"
echo -e "  ${CYAN}cat .context/code-health-report.md${NC} - View health score"
echo -e "  ${CYAN}.context/scripts/find-related.sh <term>${NC} - Find related files"
echo ""
echo -e "${GREEN}💡 Tips:${NC}"
echo -e "  1. Run ${CYAN}generate-context.sh${NC} at the start of each session"
echo -e "  2. Check ${CYAN}code-health-check.sh${NC} before committing"
echo -e "  3. Use ${CYAN}find-related.sh${NC} before making changes"
echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" 