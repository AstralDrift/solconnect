# Smart Context Generator

## Input
TARGET: $ARGUMENTS (file, function, feature, or task description)
AGENT_TYPE: $ARGUMENTS (optional: crypto-specialist, ui-specialist, etc.)

## Context Discovery Process

### 1. Analyze Target Type
```bash
TARGET="$1"
AGENT_TYPE="$2"

# Determine what type of context is needed
if [[ "$TARGET" == *".ts"* ]] || [[ "$TARGET" == *".tsx"* ]]; then
  CONTEXT_TYPE="file"
elif [[ "$TARGET" == *":"* ]]; then
  CONTEXT_TYPE="function"
elif [[ "$TARGET" == *"feature"* ]] || [[ "$TARGET" == *"implement"* ]]; then
  CONTEXT_TYPE="feature"
elif [[ "$TARGET" == *"bug"* ]] || [[ "$TARGET" == *"fix"* ]]; then
  CONTEXT_TYPE="bug"
else
  CONTEXT_TYPE="general"
fi

echo "🎯 Context Type: $CONTEXT_TYPE"
echo "🤖 Agent Type: ${AGENT_TYPE:-"general"}"
```

### 2. Intelligent File Discovery
```bash
# Smart file discovery based on target
echo "📁 Discovering relevant files..."

case "$CONTEXT_TYPE" in
  "file")
    PRIMARY_FILE="$TARGET"
    RELATED_FILES=($(find_related_files "$PRIMARY_FILE"))
    ;;
  "function") 
    PRIMARY_FILE="${TARGET%:*}"
    FUNCTION_NAME="${TARGET#*:}"
    RELATED_FILES=($(find_function_usage "$PRIMARY_FILE" "$FUNCTION_NAME"))
    ;;
  "feature"|"general")
    KEYWORDS=($(extract_keywords "$TARGET"))
    RELATED_FILES=($(search_by_keywords "${KEYWORDS[@]}"))
    ;;
  "bug")
    ERROR_KEYWORDS=($(extract_error_keywords "$TARGET"))
    RELATED_FILES=($(find_error_related_files "${ERROR_KEYWORDS[@]}"))
    ;;
esac

echo "Primary: $PRIMARY_FILE"
echo "Related: ${RELATED_FILES[@]}"
```

### 3. Build Context Map
```bash
echo "🗺️ Building intelligent context map..."

# Read primary files
if [[ -n "$PRIMARY_FILE" ]] && [[ -f "$PRIMARY_FILE" ]]; then
  echo "📖 Reading primary file: $PRIMARY_FILE"
  READ @"$PRIMARY_FILE"
fi

# Read most relevant related files (top 5)
for file in "${RELATED_FILES[@]:0:5}"; do
  if [[ -f "$file" ]]; then
    echo "📖 Reading related file: $file"
    READ @"$file"
  fi
done

# Read relevant tests
TEST_FILES=($(find_test_files "$TARGET"))
for test_file in "${TEST_FILES[@]:0:3}"; do
  if [[ -f "$test_file" ]]; then
    echo "🧪 Reading test file: $test_file"
    READ @"$test_file"
  fi
done
```

### 4. Agent-Specific Context Enhancement
```bash
if [[ -n "$AGENT_TYPE" ]]; then
  echo "🎯 Enhancing context for $AGENT_TYPE..."
  
  case "$AGENT_TYPE" in
    "crypto-specialist")
      # Focus on encryption, security, wallet integration
      CRYPTO_FILES=($(find . -name "*crypto*" -o -name "*wallet*" -o -name "*security*"))
      for file in "${CRYPTO_FILES[@]:0:3}"; do
        [[ -f "$file" ]] && READ @"$file"
      done
      echo "🔐 Security considerations for this task:"
      echo "- Ensure end-to-end encryption is maintained"
      echo "- Validate all cryptographic operations"
      echo "- Never expose private keys or sensitive data"
      ;;
      
    "ui-specialist")
      # Focus on components, styling, accessibility
      UI_FILES=($(find ./src/components -name "*.tsx" | head -5))
      STYLE_FILES=($(find . -name "*.css" -o -name "*.module.css" | head -3))
      for file in "${UI_FILES[@]}" "${STYLE_FILES[@]}"; do
        [[ -f "$file" ]] && READ @"$file"
      done
      echo "🎨 UI/UX considerations for this task:"
      echo "- Ensure mobile responsiveness"
      echo "- Add proper accessibility attributes"
      echo "- Follow existing design system patterns"
      ;;
      
    "storage-specialist")
      # Focus on data persistence, queries, performance
      STORAGE_FILES=($(find ./src/services/storage -name "*.ts" | head -5))
      for file in "${STORAGE_FILES[@]}"; do
        [[ -f "$file" ]] && READ @"$file"
      done
      echo "💾 Storage considerations for this task:"
      echo "- Optimize database queries for performance"
      echo "- Ensure data consistency and integrity"
      echo "- Consider migration strategies for schema changes"
      ;;
      
    "network-specialist")
      # Focus on WebSocket, connectivity, real-time features
      NETWORK_FILES=($(find . -name "*transport*" -o -name "*network*" -o -name "*relay*"))
      for file in "${NETWORK_FILES[@]:0:3}"; do
        [[ -f "$file" ]] && READ @"$file"
      done
      echo "🌐 Network considerations for this task:"
      echo "- Handle connection failures gracefully"
      echo "- Implement proper retry logic"
      echo "- Consider offline scenarios"
      ;;
      
    "message-flow-specialist")
      # Focus on message pipeline, events, coordination
      FLOW_FILES=($(find ./src/services -name "*Message*" -o -name "*Bus*" | head -5))
      for file in "${FLOW_FILES[@]}"; do
        [[ -f "$file" ]] && READ @"$file"
      done
      echo "📨 Message flow considerations for this task:"
      echo "- Maintain message ordering and delivery guarantees"
      echo "- Ensure proper event coordination"
      echo "- Handle message queuing and retry logic"
      ;;
  esac
fi
```

### 5. Pattern Recognition
```bash
echo "🔍 Identifying relevant patterns..."

# Look for similar implementations
if [[ "$CONTEXT_TYPE" == "feature" ]]; then
  echo "📋 Looking for similar feature implementations..."
  FEATURE_KEYWORDS=($(echo "$TARGET" | grep -oE '[a-zA-Z]{4,}'))
  for keyword in "${FEATURE_KEYWORDS[@]}"; do
    SIMILAR_FILES=($(rg -l "$keyword" --type ts --type tsx | head -3))
    for file in "${SIMILAR_FILES[@]}"; do
      echo "📖 Similar implementation pattern: $file"
      READ @"$file" --limit 100  # Read first 100 lines for patterns
    done
  done
fi

# Look for established patterns in the codebase
echo "📐 Established patterns to follow:"
echo "- Use Result<T> pattern for error handling"
echo "- Follow SolConnect naming conventions"
echo "- Implement proper TypeScript interfaces"
echo "- Add comprehensive test coverage"
```

### 6. Integration Points Analysis
```bash
echo "🔗 Analyzing integration points..."

# Find components that might be affected
if [[ -n "$PRIMARY_FILE" ]]; then
  echo "🔍 Finding components that import this file:"
  rg -l "from.*$(basename "$PRIMARY_FILE" .ts)" --type ts --type tsx | head -5
  
  echo "🔍 Finding components this file imports:"
  grep -E "^import.*from" "$PRIMARY_FILE" 2>/dev/null | head -10
fi

echo "⚠️ Potential integration considerations:"
echo "- MessageBus event coordination"
echo "- Redux store state management" 
echo "- WebSocket relay compatibility"
echo "- Cross-platform (web/mobile) support"
```

### 7. Historical Context
```bash
echo "📚 Recent development history..."

# Show recent changes to relevant files
if [[ -n "$PRIMARY_FILE" ]] && [[ -f "$PRIMARY_FILE" ]]; then
  echo "🕒 Recent changes to $PRIMARY_FILE:"
  git log --oneline -5 "$PRIMARY_FILE" 2>/dev/null || echo "No git history found"
fi

# Show recent commits related to the target
if [[ "$CONTEXT_TYPE" == "feature" ]]; then
  KEYWORDS=($(extract_keywords "$TARGET"))
  for keyword in "${KEYWORDS[@]}"; do
    echo "🕒 Recent commits mentioning '$keyword':"
    git log --grep="$keyword" --oneline -3 2>/dev/null || echo "No related commits found"
  done
fi
```

### 8. Smart Recommendations
```bash
echo "💡 Smart recommendations for this task:"

# Context-specific recommendations
case "$CONTEXT_TYPE" in
  "feature")
    echo "1. Start by creating a specification using: specs/spec_template.solconnect.md"
    echo "2. Consider feature complexity and agent assignment"
    echo "3. Follow SolConnect integration patterns"
    ;;
  "bug")
    echo "1. Reproduce the issue with a minimal test case"
    echo "2. Check recent changes that might have introduced the bug"
    echo "3. Ensure fix doesn't break existing functionality"
    ;;
  "file"|"function")
    echo "1. Understand the current implementation thoroughly"
    echo "2. Check for existing test coverage"
    echo "3. Consider impact on dependent components"
    ;;
esac

echo "✨ Context generation complete. You now have intelligent context for: $TARGET"
```

## Helper Functions

### File Discovery Functions
```bash
function find_related_files() {
  local target_file="$1"
  local base_name=$(basename "$target_file" .ts .tsx)
  
  # Find files that import this file
  rg -l "from.*$base_name" --type ts --type tsx 2>/dev/null
  
  # Find files with similar names
  find . -name "*$base_name*" -type f 2>/dev/null
  
  # Find files in the same directory
  dirname "$target_file" | xargs find -maxdepth 1 -name "*.ts" -o -name "*.tsx" 2>/dev/null
}

function find_test_files() {
  local target="$1"
  
  # Find test files for specific file
  if [[ "$target" == *".ts"* ]]; then
    local base_name=$(basename "$target" .ts .tsx)
    find . -name "*$base_name*.test.*" -o -name "*$base_name*.spec.*" 2>/dev/null
  else
    # Find test files related to keywords
    local keywords=($(extract_keywords "$target"))
    for keyword in "${keywords[@]}"; do
      find . -name "*test*" -type f -exec grep -l "$keyword" {} \; 2>/dev/null
    done
  fi
}

function extract_keywords() {
  echo "$1" | tr ' ' '\n' | grep -E '^[a-zA-Z]{3,}$' | head -5
}
```