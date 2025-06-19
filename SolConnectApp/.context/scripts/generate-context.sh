#!/bin/bash

# Generate Context Script
# Creates a comprehensive context summary for quick session startup

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTEXT_DIR="$BASE_DIR/.context"
OUTPUT_FILE="$CONTEXT_DIR/CONTEXT_SUMMARY.md"

echo -e "${BLUE}Generating context summary...${NC}"

# Start the summary file
cat > "$OUTPUT_FILE" << 'EOF'
# SolConnect Context Summary

Generated: $(date)

## 🚀 Quick Start

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start relay
npm run relay

# Terminal 3: Run checks
npm audit
npm run tsc
npm run lint
```

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

# Check for TypeScript errors
echo "### TypeScript Status" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && npm run tsc 2>&1 | tail -5 >> "$OUTPUT_FILE" || echo "TypeScript check failed"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Check for security issues
echo "### Security Audit" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && npm audit --audit-level=high 2>&1 | grep -E "(found|vulnerabilities)" >> "$OUTPUT_FILE" || echo "No high/critical vulnerabilities"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add file structure for key directories
echo "## 📁 Key Files Modified Recently" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && find src -type f -name "*.ts" -o -name "*.tsx" | \
  xargs ls -lt | head -20 | awk '{print $9}' >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add current work status
echo "## 📋 Current Work" >> "$OUTPUT_FILE"
if [ -f "$CONTEXT_DIR/current-work.md" ]; then
  # Extract just the active focus section
  awk '/## 🎯 Active Focus/,/## 🚧 In Progress/' "$CONTEXT_DIR/current-work.md" | head -n -1 >> "$OUTPUT_FILE"
else
  echo "No current work file found." >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# Add TODO/FIXME scan
echo "## 🔍 TODO/FIXME Scan" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" src/ | head -10 >> "$OUTPUT_FILE" || echo "No TODOs found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add quick links
cat >> "$OUTPUT_FILE" << 'EOF'
## 🔗 Quick Links

- **Current Work**: [current-work.md](current-work.md)
- **Architecture**: [architecture-map.md](architecture-map.md)
- **Code Patterns**: [code-patterns.md](code-patterns.md)
- **Troubleshooting**: [troubleshooting.md](troubleshooting.md)

## 💡 Key Commands

```bash
# View current work
cat .context/current-work.md

# View architecture
cat .context/architecture-map.md

# Update context
.context/scripts/update-summary.sh

# Analyze changes
.context/scripts/analyze-changes.sh
```

## 🎯 Next Actions

1. Check `current-work.md` for active tasks
2. Review any TypeScript errors above
3. Address any security vulnerabilities
4. Continue with planned features

EOF

echo -e "${GREEN}✓ Context summary generated at: $OUTPUT_FILE${NC}"
echo -e "${YELLOW}Quick view: cat $OUTPUT_FILE${NC}" 