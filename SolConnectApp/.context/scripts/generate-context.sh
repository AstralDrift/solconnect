#!/bin/bash

# Enhanced Context Generation Script for Claude
# Creates a comprehensive context summary optimized for AI-assisted development

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTEXT_DIR="$BASE_DIR/.context"
OUTPUT_FILE="$CONTEXT_DIR/CONTEXT_SUMMARY.md"
CLAUDE_FILE="$CONTEXT_DIR/CLAUDE_CONTEXT.md"

echo -e "${BLUE}🤖 Generating enhanced context summary for Claude...${NC}"

# Function to count lines of code
count_loc() {
    find "$1" -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}'
}

# Function to analyze code complexity
analyze_complexity() {
    local file=$1
    local lines=$(wc -l < "$file" 2>/dev/null || echo 0)
    local functions=$(grep -E "(function|const.*=.*=>|class )" "$file" 2>/dev/null | wc -l || echo 0)
    echo "$lines:$functions"
}

# Start the summary file
cat > "$OUTPUT_FILE" << EOF
# SolConnect Context Summary

Generated: $(date)
AI Assistant: Claude 4 (Cursor)

## 🚀 Quick Start

\`\`\`bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start relay
npm run relay

# Terminal 3: Run checks
npm audit
npm run tsc
npm run lint
\`\`\`

## 📊 Current Status

EOF

# Add git status
echo "### Git Status" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && git status --short >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add recent commits
echo "### Recent Commits" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && git log --oneline -10 >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Enhanced TypeScript analysis
echo "### TypeScript Analysis" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && npm run tsc 2>&1 | tail -10 >> "$OUTPUT_FILE" || echo "TypeScript check failed"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Security audit with more detail
echo "### Security Audit" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && npm audit 2>&1 | grep -E "(found|vulnerabilities|High|Critical|Moderate)" | head -10 >> "$OUTPUT_FILE" || echo "No vulnerabilities found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Code metrics
echo "## 📈 Code Metrics" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Metric | Value |" >> "$OUTPUT_FILE"
echo "|--------|-------|" >> "$OUTPUT_FILE"
echo "| Total LOC | $(count_loc "$BASE_DIR/src") |" >> "$OUTPUT_FILE"
echo "| TypeScript Files | $(find "$BASE_DIR/src" -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l) |" >> "$OUTPUT_FILE"
echo "| React Components | $(find "$BASE_DIR/src" -name "*.tsx" 2>/dev/null | wc -l) |" >> "$OUTPUT_FILE"
echo "| Test Files | $(find "$BASE_DIR/src" -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | wc -l) |" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Dependency analysis
echo "## 📦 Key Dependencies" >> "$OUTPUT_FILE"
echo '```json' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && cat package.json | jq '.dependencies | to_entries | map(select(.key | test("react|next|solana|ws"))) | from_entries' 2>/dev/null >> "$OUTPUT_FILE" || echo "Dependencies analysis failed"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Complex files analysis
echo "## 🔍 Complex Files (May Need Refactoring)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| File | Lines | Functions | Complexity |" >> "$OUTPUT_FILE"
echo "|------|-------|-----------|------------|" >> "$OUTPUT_FILE"

# Find complex TypeScript files
cd "$BASE_DIR" && find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    complexity=$(analyze_complexity "$file")
    lines=$(echo "$complexity" | cut -d: -f1)
    functions=$(echo "$complexity" | cut -d: -f2)
    if [ "$lines" -gt 200 ] || [ "$functions" -gt 10 ]; then
        ratio=$((lines / (functions + 1)))
        echo "| $file | $lines | $functions | $ratio |" >> "$OUTPUT_FILE"
    fi
done | sort -t'|' -k3 -nr | head -5

echo "" >> "$OUTPUT_FILE"

# Recent file changes
echo "## 📝 Recently Modified Files" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && find src -type f \( -name "*.ts" -o -name "*.tsx" \) -mtime -7 | \
  xargs ls -lt 2>/dev/null | head -15 | awk '{print $9}' >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Current work status
echo "## 📋 Current Work" >> "$OUTPUT_FILE"
if [ -f "$CONTEXT_DIR/current-work.md" ]; then
  # Extract active focus and in-progress sections
  awk '/## 🎯 Active Focus/,/## 📋 Next Up/' "$CONTEXT_DIR/current-work.md" | sed '$d' >> "$OUTPUT_FILE"
else
  echo "No current work file found." >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# Enhanced TODO/FIXME scan with context
echo "## 🔍 TODO/FIXME Analysis" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### High Priority (FIXME/HACK)" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -rn "FIXME\|HACK" --include="*.ts" --include="*.tsx" src/ | head -5 >> "$OUTPUT_FILE" || echo "None found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Standard TODOs" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -rn "TODO" --include="*.ts" --include="*.tsx" src/ | head -5 >> "$OUTPUT_FILE" || echo "None found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Test coverage summary
echo "## 🧪 Test Coverage" >> "$OUTPUT_FILE"
if [ -f "$BASE_DIR/coverage/coverage-summary.json" ]; then
    echo '```' >> "$OUTPUT_FILE"
    cat "$BASE_DIR/coverage/coverage-summary.json" | jq '.total' 2>/dev/null >> "$OUTPUT_FILE" || echo "Coverage data not available"
    echo '```' >> "$OUTPUT_FILE"
else
    echo "No coverage data found. Run \`npm test -- --coverage\` to generate." >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# Performance hints
echo "## ⚡ Performance Considerations" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Large Files" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && find src -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | sort -nr | head -5 >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Quick links section
cat >> "$OUTPUT_FILE" << 'EOF'
## 🔗 Quick Links

- **Current Work**: [current-work.md](current-work.md)
- **Architecture**: [architecture-map.md](architecture-map.md)  
- **Code Patterns**: [code-patterns.md](code-patterns.md)
- **Troubleshooting**: [troubleshooting.md](troubleshooting.md)
- **Claude Context**: [CLAUDE_CONTEXT.md](CLAUDE_CONTEXT.md)

## 💡 Key Commands

```bash
# View current work
cat .context/current-work.md

# View architecture
cat .context/architecture-map.md

# Generate Claude-specific context
.context/scripts/generate-claude-context.sh

# Analyze dependencies
.context/scripts/analyze-dependencies.sh

# Check code health
.context/scripts/code-health-check.sh
```

## 🎯 Next Actions

1. Check `current-work.md` for active tasks
2. Review any TypeScript errors above
3. Address any security vulnerabilities
4. Check complex files for refactoring opportunities
5. Continue with planned features

EOF

# Generate Claude-specific context file
echo -e "${PURPLE}🤖 Generating Claude-specific context...${NC}"

cat > "$CLAUDE_FILE" << 'EOF'
# Claude AI Context Guide

## 🤖 About This Project

SolConnect is a decentralized chat application built on Solana blockchain technology. It provides end-to-end encrypted messaging with wallet-based identity.

## 🎯 Current Development Focus

EOF

# Add current work summary
if [ -f "$CONTEXT_DIR/current-work.md" ]; then
    grep -A 10 "## 🎯 Active Focus" "$CONTEXT_DIR/current-work.md" >> "$CLAUDE_FILE"
fi

cat >> "$CLAUDE_FILE" << 'EOF'

## 🏗️ Architecture Overview

The project follows a layered architecture:
- **UI Layer**: Next.js pages and React components
- **SDK Layer**: Core business logic and services
- **Transport Layer**: WebSocket and future QUIC implementation
- **Storage Layer**: Local persistence with IndexedDB wrapper

## 📁 Key File Locations

### When working on UI:
- Screens: `src/screens/`
- Components: `src/components/`
- Styles: `src/styles/`

### When working on business logic:
- SDK: `src/services/SolConnectSDK.ts`
- Message handling: `src/services/MessageBus.ts`
- Storage: `src/services/storage/`
- Transport: `src/services/transport/`

### When working on state management:
- Store: `src/store/`
- Hooks: `src/hooks/`

## 🔧 Common Tasks

### Adding a new feature:
1. Check `architecture-map.md` for system overview
2. Review `code-patterns.md` for established patterns
3. Update `current-work.md` with your plan
4. Implement following existing patterns
5. Add tests in `__tests__` directories
6. Update `decision-log.md` if making architectural choices

### Debugging issues:
1. Check `troubleshooting.md` for known issues
2. Review recent commits for related changes
3. Use browser DevTools for frontend issues
4. Check relay logs for transport issues

### Code style preferences:
- TypeScript strict mode enabled
- Functional components with hooks
- Async/await over promises
- Comprehensive error handling
- Clear variable and function names

## 🚨 Important Constraints

1. **Security**: All messages must be encrypted end-to-end
2. **Performance**: Keep bundle size minimal
3. **Compatibility**: Support latest Chrome, Firefox, Safari
4. **Mobile**: Ensure responsive design
5. **Offline**: Handle offline scenarios gracefully

## 💬 Communication Style

When discussing code:
- Reference specific file paths
- Include relevant code snippets
- Explain the "why" behind changes
- Consider edge cases
- Think about testing

## 🔍 Context Commands for Claude

```bash
# Get latest context
.context/scripts/generate-context.sh

# Check specific subsystem
.context/scripts/analyze-subsystem.sh services

# Find related code
.context/scripts/find-related.sh "MessageBus"
```

EOF

echo -e "${GREEN}✓ Context summary generated at: $OUTPUT_FILE${NC}"
echo -e "${GREEN}✓ Claude context generated at: $CLAUDE_FILE${NC}"
echo -e "${YELLOW}Quick view: cat $OUTPUT_FILE${NC}"

# Generate a quick health report
echo ""
echo -e "${BLUE}📊 Quick Health Check:${NC}"
echo -e "TypeScript Errors: $(cd "$BASE_DIR" && npm run tsc 2>&1 | grep -c "error" || echo "0")"
echo -e "Security Issues: $(cd "$BASE_DIR" && npm audit 2>&1 | grep -c "vulnerabilities" || echo "0")"
echo -e "TODOs: $(cd "$BASE_DIR" && grep -r "TODO" --include="*.ts" --include="*.tsx" src/ | wc -l || echo "0")"
echo -e "Test Files: $(find "$BASE_DIR/src" -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | wc -l || echo "0")" 