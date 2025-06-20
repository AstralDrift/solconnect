# Development Session Learning Capture

## Post-Implementation Learning Capture
> Automatically captures knowledge after each development session

## Input
FEATURE_NAME: $ARGUMENTS
SESSION_ID: $ARGUMENTS (auto-generated if not provided)

## Learning Capture Process

### 1. Session Metadata Collection
```bash
SESSION_ID="${SESSION_ID:-$(date +%Y%m%d_%H%M%S)_$(echo $FEATURE_NAME | tr ' ' '_')}"
START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "📊 Capturing learning session: $SESSION_ID"
echo "🎯 Feature: $FEATURE_NAME"
echo "⏰ Session started: $START_TIME"

# Detect what was actually implemented
MODIFIED_FILES=($(git diff --name-only HEAD~1 2>/dev/null || echo "No git changes detected"))
ADDED_FILES=($(git diff --diff-filter=A --name-only HEAD~1 2>/dev/null))
DELETED_FILES=($(git diff --diff-filter=D --name-only HEAD~1 2>/dev/null))

echo "📝 Files modified: ${#MODIFIED_FILES[@]}"
echo "➕ Files added: ${#ADDED_FILES[@]}"
echo "➖ Files deleted: ${#DELETED_FILES[@]}"
```

### 2. Implementation Analysis
```bash
echo "🔍 Analyzing implementation details..."

# Extract implementation patterns
COMPONENTS_TOUCHED=()
SERVICES_MODIFIED=()
TESTS_ADDED=()

for file in "${MODIFIED_FILES[@]}" "${ADDED_FILES[@]}"; do
  case "$file" in
    */components/*)
      COMPONENTS_TOUCHED+=("$file")
      ;;
    */services/*)
      SERVICES_MODIFIED+=("$file")
      ;;
    *test* | *spec*)
      TESTS_ADDED+=("$file")
      ;;
  esac
done

echo "🧩 Components touched: ${#COMPONENTS_TOUCHED[@]}"
echo "⚙️ Services modified: ${#SERVICES_MODIFIED[@]}"
echo "🧪 Tests added: ${#TESTS_ADDED[@]}"

# Analyze code complexity
TOTAL_LINES_ADDED=$(git diff --shortstat HEAD~1 2>/dev/null | grep -o '[0-9]* insertions' | cut -d' ' -f1 || echo 0)
TOTAL_LINES_DELETED=$(git diff --shortstat HEAD~1 2>/dev/null | grep -o '[0-9]* deletions' | cut -d' ' -f1 || echo 0)

echo "📏 Lines added: $TOTAL_LINES_ADDED"
echo "📏 Lines deleted: $TOTAL_LINES_DELETED"
```

### 3. Quality Assessment
```bash
echo "✅ Running quality assessment..."

# Run tests and capture results
TEST_RESULTS=""
if [[ -f "package.json" ]] && grep -q '"test"' package.json; then
  echo "🧪 Running tests..."
  TEST_OUTPUT=$(npm test 2>&1)
  TEST_EXIT_CODE=$?
  
  if [[ $TEST_EXIT_CODE -eq 0 ]]; then
    TEST_RESULTS="PASSED"
    TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -o '[0-9]* passing' | cut -d' ' -f1 || echo "unknown")
    echo "✅ Tests passed: $TEST_COUNT"
  else
    TEST_RESULTS="FAILED"
    FAILED_COUNT=$(echo "$TEST_OUTPUT" | grep -o '[0-9]* failing' | cut -d' ' -f1 || echo "unknown")
    echo "❌ Tests failed: $FAILED_COUNT"
  fi
fi

# Run linting
LINT_RESULTS=""
if [[ -f "package.json" ]] && grep -q '"lint"' package.json; then
  echo "🔍 Running linting..."
  LINT_OUTPUT=$(npm run lint 2>&1)
  LINT_EXIT_CODE=$?
  
  if [[ $LINT_EXIT_CODE -eq 0 ]]; then
    LINT_RESULTS="CLEAN"
    echo "✅ Linting passed"
  else
    LINT_RESULTS="ISSUES"
    LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -c 'error' || echo 0)
    LINT_WARNINGS=$(echo "$LINT_OUTPUT" | grep -c 'warning' || echo 0)
    echo "⚠️ Lint errors: $LINT_ERRORS, warnings: $LINT_WARNINGS"
  fi
fi

# Type checking
TYPE_RESULTS=""
if [[ -f "package.json" ]] && grep -q '"typecheck"' package.json; then
  echo "🔍 Running type checking..."
  TYPE_OUTPUT=$(npm run typecheck 2>&1)
  TYPE_EXIT_CODE=$?
  
  if [[ $TYPE_EXIT_CODE -eq 0 ]]; then
    TYPE_RESULTS="CLEAN"
    echo "✅ Type checking passed"
  else
    TYPE_RESULTS="ERRORS"
    TYPE_ERRORS=$(echo "$TYPE_OUTPUT" | grep -c 'error' || echo 0)
    echo "❌ Type errors: $TYPE_ERRORS"
  fi
fi
```

### 4. Performance Impact Analysis
```bash
echo "⚡ Analyzing performance impact..."

# Bundle size impact (if applicable)
BUNDLE_SIZE_BEFORE=""
BUNDLE_SIZE_AFTER=""

if [[ -f "package.json" ]] && grep -q '"build"' package.json; then
  echo "📦 Checking bundle size impact..."
  
  # Get current bundle size
  npm run build >/dev/null 2>&1
  if [[ -d ".next" ]]; then
    BUNDLE_SIZE_AFTER=$(du -sh .next/static 2>/dev/null | cut -f1 || echo "unknown")
    echo "📦 Current bundle size: $BUNDLE_SIZE_AFTER"
  fi
fi

# Memory usage (basic estimation)
MEMORY_IMPACT="unknown"
if [[ ${#MODIFIED_FILES[@]} -gt 5 ]] || [[ $TOTAL_LINES_ADDED -gt 500 ]]; then
  MEMORY_IMPACT="potentially_significant"
elif [[ ${#MODIFIED_FILES[@]} -gt 2 ]] || [[ $TOTAL_LINES_ADDED -gt 100 ]]; then
  MEMORY_IMPACT="moderate"
else
  MEMORY_IMPACT="minimal"
fi

echo "🧠 Estimated memory impact: $MEMORY_IMPACT"
```

### 5. Pattern Recognition
```bash
echo "🔍 Identifying implementation patterns..."

# Detect architectural patterns
ARCHITECTURAL_PATTERNS=()

# Check for common SolConnect patterns
if grep -r "Result<" "${MODIFIED_FILES[@]}" 2>/dev/null | head -1 >/dev/null; then
  ARCHITECTURAL_PATTERNS+=("Result_pattern")
fi

if grep -r "MessageBus" "${MODIFIED_FILES[@]}" 2>/dev/null | head -1 >/dev/null; then
  ARCHITECTURAL_PATTERNS+=("MessageBus_integration")
fi

if grep -r "React.memo\|useMemo\|useCallback" "${MODIFIED_FILES[@]}" 2>/dev/null | head -1 >/dev/null; then
  ARCHITECTURAL_PATTERNS+=("React_optimization")
fi

if grep -r "encrypt\|decrypt" "${MODIFIED_FILES[@]}" 2>/dev/null | head -1 >/dev/null; then
  ARCHITECTURAL_PATTERNS+=("Encryption_integration")
fi

echo "🏗️ Architectural patterns detected: ${ARCHITECTURAL_PATTERNS[*]}"

# Detect implementation complexity
COMPLEXITY_INDICATORS=()

if [[ ${#SERVICES_MODIFIED[@]} -gt 2 ]]; then
  COMPLEXITY_INDICATORS+=("multi_service")
fi

if [[ ${#COMPONENTS_TOUCHED[@]} -gt 3 ]]; then
  COMPLEXITY_INDICATORS+=("multi_component")
fi

if grep -r "WebSocket\|relay" "${MODIFIED_FILES[@]}" 2>/dev/null | head -1 >/dev/null; then
  COMPLEXITY_INDICATORS+=("network_integration")
fi

echo "⚙️ Complexity indicators: ${COMPLEXITY_INDICATORS[*]}"
```

### 6. Issue and Success Capture
```bash
echo "📋 Capturing issues and successes..."

# Check for recent commits that might indicate issues
RECENT_COMMITS=$(git log --oneline -5 --grep="fix\|bug\|issue" 2>/dev/null || echo "")
ISSUES_ENCOUNTERED=()

if [[ -n "$RECENT_COMMITS" ]]; then
  while IFS= read -r commit; do
    ISSUES_ENCOUNTERED+=("$commit")
  done <<< "$RECENT_COMMITS"
fi

# Success indicators
SUCCESSES=()

if [[ "$TEST_RESULTS" == "PASSED" ]]; then
  SUCCESSES+=("tests_passing")
fi

if [[ "$LINT_RESULTS" == "CLEAN" ]]; then
  SUCCESSES+=("clean_code")
fi

if [[ "$TYPE_RESULTS" == "CLEAN" ]]; then
  SUCCESSES+=("type_safe")
fi

if [[ ${#TESTS_ADDED[@]} -gt 0 ]]; then
  SUCCESSES+=("test_coverage_added")
fi

echo "✅ Successes: ${SUCCESSES[*]}"
echo "⚠️ Issues encountered: ${#ISSUES_ENCOUNTERED[@]}"
```

### 7. Generate Learning Report
```bash
echo "📊 Generating learning report..."

LEARNING_REPORT=".claude/intelligence/sessions/${SESSION_ID}.md"
mkdir -p "$(dirname "$LEARNING_REPORT")"

cat > "$LEARNING_REPORT" << EOF
# Development Session Learning Report

## Session Overview
- **Session ID**: $SESSION_ID
- **Feature**: $FEATURE_NAME
- **Timestamp**: $START_TIME
- **Duration**: $(($(date +%s) - $(date -d "$START_TIME" +%s 2>/dev/null || echo 0))) seconds

## Implementation Summary
- **Files Modified**: ${#MODIFIED_FILES[@]}
- **Files Added**: ${#ADDED_FILES[@]}
- **Files Deleted**: ${#DELETED_FILES[@]}
- **Lines Added**: $TOTAL_LINES_ADDED
- **Lines Deleted**: $TOTAL_LINES_DELETED

### Components Affected
- **UI Components**: ${#COMPONENTS_TOUCHED[@]}
- **Services**: ${#SERVICES_MODIFIED[@]}
- **Tests**: ${#TESTS_ADDED[@]}

## Quality Metrics
- **Tests**: $TEST_RESULTS
- **Linting**: $LINT_RESULTS
- **Type Checking**: $TYPE_RESULTS
- **Bundle Size**: $BUNDLE_SIZE_AFTER
- **Memory Impact**: $MEMORY_IMPACT

## Patterns Identified
- **Architectural**: ${ARCHITECTURAL_PATTERNS[*]}
- **Complexity**: ${COMPLEXITY_INDICATORS[*]}

## Outcomes
### Successes
$(printf '- %s\n' "${SUCCESSES[@]}")

### Issues Encountered
$(printf '- %s\n' "${ISSUES_ENCOUNTERED[@]}")

## Files Modified
$(printf '- %s\n' "${MODIFIED_FILES[@]}")

## Recommendations for Future
- Follow established patterns: ${ARCHITECTURAL_PATTERNS[*]}
- Monitor complexity indicators: ${COMPLEXITY_INDICATORS[*]}
- Continue testing practices that led to: ${SUCCESSES[*]}

---
*Generated automatically by SolConnect Learning System*
EOF

echo "📝 Learning report saved: $LEARNING_REPORT"
```

### 8. Update Repository Knowledge
```bash
echo "🧠 Updating repository knowledge base..."

# Update pattern database
PATTERNS_DB=".claude/intelligence/patterns.json"
mkdir -p "$(dirname "$PATTERNS_DB")"

# Create or update patterns database
if [[ ! -f "$PATTERNS_DB" ]]; then
  echo '{"patterns": [], "lastUpdated": ""}' > "$PATTERNS_DB"
fi

# Add new patterns discovered in this session
for pattern in "${ARCHITECTURAL_PATTERNS[@]}"; do
  echo "Adding pattern: $pattern to knowledge base"
  # This would typically update a JSON database
done

# Update success/failure statistics
STATS_DB=".claude/intelligence/stats.json"
if [[ ! -f "$STATS_DB" ]]; then
  echo '{"totalSessions": 0, "successRate": 0, "averageComplexity": 0}' > "$STATS_DB"
fi

echo "📈 Knowledge base updated"
echo "✨ Session learning capture complete!"
```

## Auto-Integration with Feature Implementation

### Trigger Learning Capture After Implementation
```bash
# Add this to the end of auto-implement.md
echo "🎓 Capturing learning from this session..."
claude --command .claude/commands/learn-from-session.md "$FEATURE_NAME"
```

### Integration with Git Hooks
```bash
# Post-commit hook to automatically capture learning
#!/bin/bash
# .git/hooks/post-commit

LAST_COMMIT_MSG=$(git log -1 --pretty=%B)
if [[ "$LAST_COMMIT_MSG" == *"feat:"* ]] || [[ "$LAST_COMMIT_MSG" == *"feature:"* ]]; then
  FEATURE_NAME=$(echo "$LAST_COMMIT_MSG" | sed 's/feat: //g' | sed 's/feature: //g')
  claude --command .claude/commands/learn-from-session.md "$FEATURE_NAME"
fi
```