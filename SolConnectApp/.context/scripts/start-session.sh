#!/bin/bash

# Session Startup Script
# Automates context loading and provides a quick session overview

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTEXT_DIR="$BASE_DIR/.context"

# Clear screen for clean start
clear

echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${PURPLE}       🚀 Starting SolConnect Development Session${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Generate fresh context
echo -e "${BLUE}📋 Generating fresh context...${NC}"
"$CONTEXT_DIR/scripts/generate-context.sh" > /dev/null 2>&1

# Step 2: Run quick health check
echo -e "${BLUE}🏥 Running health check...${NC}"
HEALTH_OUTPUT=$("$CONTEXT_DIR/scripts/code-health-check.sh" 2>&1)
HEALTH_SCORE=$(echo "$HEALTH_OUTPUT" | grep "Health Score:" | sed 's/.*Health Score: \([0-9]*\).*/\1/')

# Step 3: Extract key metrics
TS_ERRORS=$(cd "$BASE_DIR" && npm run tsc 2>&1 | grep -c "error" || echo "0")
SECURITY_ISSUES=$(cd "$BASE_DIR" && npm audit 2>&1 | grep -c "vulnerabilities" || echo "0")
TODO_COUNT=$(cd "$BASE_DIR" && grep -r "TODO\|FIXME" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | wc -l || echo "0")

# Display session overview
echo ""
echo -e "${GREEN}✓ Context loaded successfully!${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                    📊 Project Status${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Health score with color
if [ "$HEALTH_SCORE" -ge 80 ]; then
    echo -e "🏥 Health Score: ${GREEN}${HEALTH_SCORE}/100${NC} - Excellent"
elif [ "$HEALTH_SCORE" -ge 60 ]; then
    echo -e "🏥 Health Score: ${YELLOW}${HEALTH_SCORE}/100${NC} - Good"
else
    echo -e "🏥 Health Score: ${RED}${HEALTH_SCORE}/100${NC} - Needs Attention"
fi

# TypeScript errors
if [ "$TS_ERRORS" -eq 0 ]; then
    echo -e "📝 TypeScript: ${GREEN}✓ No errors${NC}"
else
    echo -e "📝 TypeScript: ${RED}✗ ${TS_ERRORS} errors${NC}"
fi

# Security issues
if [ "$SECURITY_ISSUES" -eq 0 ]; then
    echo -e "🔒 Security: ${GREEN}✓ No vulnerabilities${NC}"
else
    echo -e "🔒 Security: ${YELLOW}⚠ ${SECURITY_ISSUES} vulnerabilities${NC}"
fi

# TODOs
echo -e "📋 TODOs: ${CYAN}${TODO_COUNT} items${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                    🎯 Current Work${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Show current work focus
if [ -f "$CONTEXT_DIR/current-work.md" ]; then
    grep -A 5 "## 🎯 Active Focus" "$CONTEXT_DIR/current-work.md" | tail -n +2 | head -5 || echo "No active work documented"
else
    echo "No current work file found"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                    🚀 Quick Actions${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Quick actions based on status
if [ "$TS_ERRORS" -gt 0 ]; then
    echo -e "${YELLOW}1. Fix TypeScript errors:${NC}"
    echo -e "   ${CYAN}npm run tsc${NC}"
    echo ""
fi

if [ "$SECURITY_ISSUES" -gt 0 ]; then
    echo -e "${YELLOW}2. Fix security issues:${NC}"
    echo -e "   ${CYAN}npm audit fix${NC}"
    echo ""
fi

echo -e "${GREEN}Start development:${NC}"
echo -e "   Terminal 1: ${CYAN}npm run dev${NC}"
echo -e "   Terminal 2: ${CYAN}npm run relay${NC}"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                    📚 Useful Commands${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}cat .context/CLAUDE_CONTEXT.md${NC} - View Claude-specific context"
echo -e "${CYAN}cat .context/current-work.md${NC} - View detailed work status"
echo -e "${CYAN}.context/scripts/find-related.sh <term>${NC} - Find related files"
echo -e "${CYAN}.context/scripts/analyze-subsystem.sh <name>${NC} - Deep dive analysis"
echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Session ready! Happy coding with Claude! 🤖${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Optional: Open key files in editor
# code "$CONTEXT_DIR/CLAUDE_CONTEXT.md" "$CONTEXT_DIR/current-work.md" 