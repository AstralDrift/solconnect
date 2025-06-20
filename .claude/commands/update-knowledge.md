# Auto-Update Repository Knowledge

## Intelligent Knowledge Maintenance
> Automatically updates documentation, patterns, and guides based on code changes

## Triggers
- Post-commit hook
- Manual execution
- Scheduled maintenance
- Feature completion

## Knowledge Update Process

### 1. Analyze Recent Changes
```bash
echo "🔍 Analyzing recent changes for knowledge updates..."

# Get recent commits (default: last 5)
COMMIT_COUNT="${1:-5}"
RECENT_COMMITS=($(git log --oneline -n "$COMMIT_COUNT" --pretty=format:"%H" 2>/dev/null))

if [[ ${#RECENT_COMMITS[@]} -eq 0 ]]; then
  echo "No recent commits found"
  exit 0
fi

echo "📊 Analyzing ${#RECENT_COMMITS[@]} recent commits..."

# Analyze changed files across recent commits
CHANGED_FILES=()
for commit in "${RECENT_COMMITS[@]}"; do
  FILES=($(git diff-tree --no-commit-id --name-only -r "$commit" 2>/dev/null))
  CHANGED_FILES+=("${FILES[@]}")
done

# Remove duplicates
UNIQUE_FILES=($(printf '%s\n' "${CHANGED_FILES[@]}" | sort -u))
echo "📁 Unique files changed: ${#UNIQUE_FILES[@]}"
```

### 2. Categorize Impact Areas
```bash
echo "🏗️ Categorizing impact areas..."

# Categorize files by impact type
ARCHITECTURE_CHANGES=()
API_CHANGES=()
PATTERN_CHANGES=()
DOCUMENTATION_CHANGES=()
COMPONENT_CHANGES=()

for file in "${UNIQUE_FILES[@]}"; do
  case "$file" in
    # Core architecture files
    *services/SolConnectSDK.ts | *services/MessageBus.ts | *services/MessageTransport.ts)
      ARCHITECTURE_CHANGES+=("$file")
      API_CHANGES+=("$file")
      ;;
    
    # Service layer changes
    *services/*)
      API_CHANGES+=("$file")
      if grep -q "interface\|class\|type" "$file" 2>/dev/null; then
        PATTERN_CHANGES+=("$file")
      fi
      ;;
    
    # Component changes
    *components/*)
      COMPONENT_CHANGES+=("$file")
      if grep -q "export.*React.FC\|export default" "$file" 2>/dev/null; then
        PATTERN_CHANGES+=("$file")
      fi
      ;;
    
    # Documentation changes
    *.md | *docs/*)
      DOCUMENTATION_CHANGES+=("$file")
      ;;
    
    # Type definitions
    *types/*)
      API_CHANGES+=("$file")
      PATTERN_CHANGES+=("$file")
      ;;
  esac
done

echo "🏗️ Architecture changes: ${#ARCHITECTURE_CHANGES[@]}"
echo "🔌 API changes: ${#API_CHANGES[@]}"
echo "📐 Pattern changes: ${#PATTERN_CHANGES[@]}"
echo "🧩 Component changes: ${#COMPONENT_CHANGES[@]}"
echo "📚 Documentation changes: ${#DOCUMENTATION_CHANGES[@]}"
```

### 3. Update Architecture Documentation
```bash
if [[ ${#ARCHITECTURE_CHANGES[@]} -gt 0 ]]; then
  echo "🏗️ Updating architecture documentation..."
  
  # Re-analyze component relationships
  echo "Analyzing component relationships..."
  
  # Create updated architecture overview
  cat > "docs/architecture/auto-generated-overview.md" << EOF
# SolConnect Architecture Overview
*Auto-generated on $(date)*

## Core Components

### Services Layer
$(find src/services -name "*.ts" -exec basename {} .ts \; | sed 's/^/- /')

### Transport Layer  
$(find src/services/transport -name "*.ts" -exec basename {} .ts \; | sed 's/^/- /')

### Storage Layer
$(find src/services/storage -name "*.ts" -exec basename {} .ts \; | sed 's/^/- /')

### Recent Changes
$(printf '- %s\n' "${ARCHITECTURE_CHANGES[@]}")

## Component Dependencies
\`\`\`mermaid
graph TD
    SDK[SolConnectSDK] --> Bus[MessageBus]
    SDK --> Crypto[CryptoService]
    Bus --> Transport[MessageTransport]
    Bus --> Storage[MessageStorage]
    Transport --> Relay[WebSocket Relay]
    Crypto --> Wallet[WalletService]
EOF

  # Add dynamic relationships based on actual imports
  for file in "${ARCHITECTURE_CHANGES[@]}"; do
    if [[ -f "$file" ]]; then
      IMPORTS=$(grep -E "^import.*from" "$file" | head -5)
      if [[ -n "$IMPORTS" ]]; then
        echo "    // Imports from $file" >> "docs/architecture/auto-generated-overview.md"
        echo "$IMPORTS" | while read import_line; do
          echo "    // $import_line" >> "docs/architecture/auto-generated-overview.md"
        done
      fi
    fi
  done
  
  echo '```' >> "docs/architecture/auto-generated-overview.md"
  echo "" >> "docs/architecture/auto-generated-overview.md"
  echo "*Last updated: $(date)*" >> "docs/architecture/auto-generated-overview.md"
  
  echo "✅ Architecture documentation updated"
fi
```

### 4. Update API Documentation
```bash
if [[ ${#API_CHANGES[@]} -gt 0 ]]; then
  echo "🔌 Updating API documentation..."
  
  mkdir -p "docs/api/auto-generated"
  
  for api_file in "${API_CHANGES[@]}"; do
    if [[ -f "$api_file" ]]; then
      echo "Documenting API changes in: $api_file"
      
      # Extract class and interface definitions
      API_DOC="docs/api/auto-generated/$(basename "$api_file" .ts).md"
      
      cat > "$API_DOC" << EOF
# $(basename "$api_file" .ts) API
*Auto-generated from $api_file on $(date)*

## Classes and Interfaces
EOF
      
      # Extract TypeScript interfaces and classes
      grep -n "^export.*interface\|^export.*class\|^export.*type" "$api_file" 2>/dev/null | while read line; do
        echo "- Line ${line%%:*}: \`${line#*:}\`" >> "$API_DOC"
      done
      
      # Extract public methods
      echo "" >> "$API_DOC"
      echo "## Public Methods" >> "$API_DOC"
      grep -n "^\s*public\|^\s*async.*(" "$api_file" 2>/dev/null | head -10 | while read line; do
        echo "- Line ${line%%:*}: \`${line#*:}\`" >> "$API_DOC"
      done
      
      # Extract important comments
      echo "" >> "$API_DOC"
      echo "## Documentation Comments" >> "$API_DOC"
      grep -n "^\s*\/\*\*\|^\s*\*.*\|^\s*\/\/" "$api_file" 2>/dev/null | head -10 | while read line; do
        echo "- ${line}" >> "$API_DOC"
      done
    fi
  done
  
  echo "✅ API documentation updated"
fi
```

### 5. Update Pattern Library
```bash
if [[ ${#PATTERN_CHANGES[@]} -gt 0 ]]; then
  echo "📐 Updating pattern library..."
  
  mkdir -p ".claude/intelligence/patterns"
  PATTERNS_DOC=".claude/intelligence/patterns/auto-detected.md"
  
  cat > "$PATTERNS_DOC" << EOF
# Auto-Detected Patterns
*Generated on $(date)*

## Detected Implementation Patterns
EOF
  
  for file in "${PATTERN_CHANGES[@]}"; do
    if [[ -f "$file" ]]; then
      echo "Analyzing patterns in: $file"
      
      # Detect Result<T> pattern
      if grep -q "Result<" "$file"; then
        echo "### Result Pattern Usage" >> "$PATTERNS_DOC"
        echo "- **File**: $file" >> "$PATTERNS_DOC"
        echo "- **Pattern**: Result<T> for error handling" >> "$PATTERNS_DOC"
        echo "\`\`\`typescript" >> "$PATTERNS_DOC"
        grep -A 2 -B 1 "Result<" "$file" | head -5 >> "$PATTERNS_DOC"
        echo "\`\`\`" >> "$PATTERNS_DOC"
        echo "" >> "$PATTERNS_DOC"
      fi
      
      # Detect React optimization patterns
      if grep -q "React.memo\|useMemo\|useCallback" "$file"; then
        echo "### React Optimization Pattern" >> "$PATTERNS_DOC"
        echo "- **File**: $file" >> "$PATTERNS_DOC"
        echo "- **Pattern**: Performance optimization" >> "$PATTERNS_DOC"
        echo "\`\`\`typescript" >> "$PATTERNS_DOC"
        grep -A 2 -B 1 "React.memo\|useMemo\|useCallback" "$file" | head -5 >> "$PATTERNS_DOC"
        echo "\`\`\`" >> "$PATTERNS_DOC"
        echo "" >> "$PATTERNS_DOC"
      fi
      
      # Detect encryption patterns
      if grep -q "encrypt\|decrypt\|crypto" "$file"; then
        echo "### Encryption Pattern" >> "$PATTERNS_DOC"
        echo "- **File**: $file" >> "$PATTERNS_DOC"
        echo "- **Pattern**: Encryption/decryption implementation" >> "$PATTERNS_DOC"
        echo "\`\`\`typescript" >> "$PATTERNS_DOC"
        grep -A 2 -B 1 "encrypt\|decrypt" "$file" | head -5 >> "$PATTERNS_DOC"
        echo "\`\`\`" >> "$PATTERNS_DOC"
        echo "" >> "$PATTERNS_DOC"
      fi
    fi
  done
  
  echo "✅ Pattern library updated"
fi
```

### 6. Update Integration Guides
```bash
echo "🔗 Updating integration guides..."

INTEGRATION_DOC="docs/integration/auto-generated-guide.md"
mkdir -p "$(dirname "$INTEGRATION_DOC")"

cat > "$INTEGRATION_DOC" << EOF
# SolConnect Integration Guide
*Auto-generated on $(date)*

## Quick Start Integration

### 1. Initialize SolConnect SDK
\`\`\`typescript
import { SolConnectSDK } from '@/services/SolConnectSDK';

const sdk = new SolConnectSDK();
await sdk.initialize();
\`\`\`

### 2. Common Integration Patterns

#### Message Sending
\`\`\`typescript
const result = await sdk.sendMessage({
  content: "Hello, World!",
  recipient: "recipient-wallet-address"
});

if (result.success) {
  console.log("Message sent:", result.data);
} else {
  console.error("Failed to send:", result.error);
}
\`\`\`

#### Event Handling
\`\`\`typescript
import { MessageBus } from '@/services/MessageBus';

MessageBus.on('message-received', (message) => {
  console.log("New message:", message);
});
\`\`\`

## Recent Integration Examples
EOF

# Add examples from recent changes
for file in "${UNIQUE_FILES[@]}"; do
  if [[ -f "$file" ]] && grep -q "SolConnectSDK\|MessageBus" "$file" 2>/dev/null; then
    echo "### Integration in $(basename "$file")" >> "$INTEGRATION_DOC"
    echo "\`\`\`typescript" >> "$INTEGRATION_DOC"
    grep -A 3 -B 1 "SolConnectSDK\|MessageBus" "$file" | head -8 >> "$INTEGRATION_DOC"
    echo "\`\`\`" >> "$INTEGRATION_DOC"
    echo "" >> "$INTEGRATION_DOC"
  fi
done

echo "✅ Integration guides updated"
```

### 7. Update Context Intelligence
```bash
echo "🧠 Updating context intelligence..."

# Update the context engine with new patterns and knowledge
CONTEXT_UPDATE=".claude/intelligence/context-updates.json"
mkdir -p "$(dirname "$CONTEXT_UPDATE")"

# Create or update context intelligence database
cat > "$CONTEXT_UPDATE" << EOF
{
  "lastUpdate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "filesAnalyzed": ${#UNIQUE_FILES[@]},
  "patternsDetected": [
EOF

# Detect and record new patterns for context intelligence
PATTERN_COUNT=0
for file in "${PATTERN_CHANGES[@]}"; do
  if [[ -f "$file" ]]; then
    # Detect patterns and add to context intelligence
    if grep -q "Result<" "$file"; then
      if [[ $PATTERN_COUNT -gt 0 ]]; then echo "," >> "$CONTEXT_UPDATE"; fi
      echo "    {\"pattern\": \"Result\", \"file\": \"$file\", \"confidence\": 0.9}" >> "$CONTEXT_UPDATE"
      ((PATTERN_COUNT++))
    fi
    
    if grep -q "React.memo" "$file"; then
      if [[ $PATTERN_COUNT -gt 0 ]]; then echo "," >> "$CONTEXT_UPDATE"; fi
      echo "    {\"pattern\": \"ReactOptimization\", \"file\": \"$file\", \"confidence\": 0.8}" >> "$CONTEXT_UPDATE"
      ((PATTERN_COUNT++))
    fi
  fi
done

cat >> "$CONTEXT_UPDATE" << EOF
  ],
  "architectureChanges": [
$(printf '    "%s"' "${ARCHITECTURE_CHANGES[@]}" | sed 's/$/,/' | sed '$s/,$//')
  ],
  "componentRelationships": "updated",
  "knowledgeConfidence": $(echo "scale=2; $PATTERN_COUNT / ${#UNIQUE_FILES[@]}" | bc -l 2>/dev/null || echo "0.5")
}
EOF

echo "✅ Context intelligence updated"
```

### 8. Generate Summary Report
```bash
echo "📊 Generating knowledge update summary..."

SUMMARY_REPORT=".claude/intelligence/update-reports/$(date +%Y%m%d_%H%M%S).md"
mkdir -p "$(dirname "$SUMMARY_REPORT")"

cat > "$SUMMARY_REPORT" << EOF
# Knowledge Update Report
*Generated on $(date)*

## Summary
- **Commits Analyzed**: ${#RECENT_COMMITS[@]}
- **Files Changed**: ${#UNIQUE_FILES[@]}
- **Knowledge Areas Updated**: $(( (${#ARCHITECTURE_CHANGES[@]} > 0) + (${#API_CHANGES[@]} > 0) + (${#PATTERN_CHANGES[@]} > 0) + (${#COMPONENT_CHANGES[@]} > 0) ))

## Updated Knowledge Areas

### Architecture Documentation
- Files updated: ${#ARCHITECTURE_CHANGES[@]}
- Status: $([[ ${#ARCHITECTURE_CHANGES[@]} -gt 0 ]] && echo "✅ Updated" || echo "⏭️ No changes")

### API Documentation  
- Files updated: ${#API_CHANGES[@]}
- Status: $([[ ${#API_CHANGES[@]} -gt 0 ]] && echo "✅ Updated" || echo "⏭️ No changes")

### Pattern Library
- Files updated: ${#PATTERN_CHANGES[@]}
- Status: $([[ ${#PATTERN_CHANGES[@]} -gt 0 ]] && echo "✅ Updated" || echo "⏭️ No changes")

### Integration Guides
- Status: ✅ Updated

### Context Intelligence
- Patterns detected: $PATTERN_COUNT
- Status: ✅ Updated

## Files Processed
$(printf '- %s\n' "${UNIQUE_FILES[@]}")

## Next Scheduled Update
- Automatic: Next commit
- Manual: Run \`claude --command .claude/commands/update-knowledge.md\`

---
*This report was generated automatically by the SolConnect Knowledge Update System*
EOF

echo "📝 Summary report: $SUMMARY_REPORT"
echo "✨ Knowledge update complete!"
```

## Integration with Development Workflow

### Git Hook Integration
```bash
#!/bin/bash
# .git/hooks/post-commit
echo "🧠 Updating repository knowledge after commit..."
claude --command .claude/commands/update-knowledge.md 1
```

### Scheduled Updates
```bash
#!/bin/bash
# Add to crontab: 0 2 * * * /path/to/update-knowledge.sh
echo "🌙 Nightly knowledge update..."
claude --command .claude/commands/update-knowledge.md 10
```