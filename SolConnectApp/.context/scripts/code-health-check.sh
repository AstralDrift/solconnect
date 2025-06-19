#!/bin/bash

# Code Health Check Script
# Comprehensive analysis of code quality and health metrics

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_FILE="$BASE_DIR/.context/code-health-report.md"

echo -e "${BLUE}🏥 Running comprehensive code health check...${NC}"

# Function to calculate health score
calculate_health_score() {
    local score=100
    local ts_errors=$1
    local security_issues=$2
    local todo_count=$3
    local test_coverage=$4
    
    # Deduct points for issues
    score=$((score - ts_errors * 5))
    score=$((score - security_issues * 10))
    score=$((score - todo_count / 5))
    
    # Adjust for test coverage
    if [ "$test_coverage" -lt 80 ]; then
        score=$((score - (80 - test_coverage) / 2))
    fi
    
    # Ensure score doesn't go below 0
    if [ $score -lt 0 ]; then
        score=0
    fi
    
    echo $score
}

# Start the report
cat > "$OUTPUT_FILE" << EOF
# Code Health Report

Generated: $(date)

## 🏥 Overall Health Score

EOF

# Collect metrics
echo -e "${YELLOW}Collecting metrics...${NC}"

# TypeScript errors
TS_ERRORS=$(cd "$BASE_DIR" && npm run tsc 2>&1 | grep -c "error" || echo "0")

# Security issues
SECURITY_ISSUES=$(cd "$BASE_DIR" && npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities.high + .metadata.vulnerabilities.critical' || echo "0")

# TODO count
TODO_COUNT=$(cd "$BASE_DIR" && grep -r "TODO\|FIXME\|HACK" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | wc -l || echo "0")

# Test file count
TEST_COUNT=$(find "$BASE_DIR/src" -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | wc -l || echo "0")

# Calculate health score
HEALTH_SCORE=$(calculate_health_score "$TS_ERRORS" "$SECURITY_ISSUES" "$TODO_COUNT" "50")

# Display health score with color
if [ $HEALTH_SCORE -ge 80 ]; then
    echo "### 🟢 Health Score: $HEALTH_SCORE/100 - Excellent" >> "$OUTPUT_FILE"
elif [ $HEALTH_SCORE -ge 60 ]; then
    echo "### 🟡 Health Score: $HEALTH_SCORE/100 - Good" >> "$OUTPUT_FILE"
elif [ $HEALTH_SCORE -ge 40 ]; then
    echo "### 🟠 Health Score: $HEALTH_SCORE/100 - Needs Attention" >> "$OUTPUT_FILE"
else
    echo "### 🔴 Health Score: $HEALTH_SCORE/100 - Critical" >> "$OUTPUT_FILE"
fi

echo "" >> "$OUTPUT_FILE"

# Detailed metrics
cat >> "$OUTPUT_FILE" << EOF
## 📊 Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| TypeScript Errors | $TS_ERRORS | $([ $TS_ERRORS -eq 0 ] && echo "✅" || echo "❌") |
| Security Issues | $SECURITY_ISSUES | $([ $SECURITY_ISSUES -eq 0 ] && echo "✅" || echo "⚠️") |
| TODOs/FIXMEs | $TODO_COUNT | $([ $TODO_COUNT -lt 20 ] && echo "✅" || echo "⚠️") |
| Test Files | $TEST_COUNT | $([ $TEST_COUNT -gt 5 ] && echo "✅" || echo "❌") |

## 🔍 Detailed Analysis

EOF

# Code complexity analysis
echo "### 📏 Code Complexity" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Files with high complexity (lines/functions ratio > 20):" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

cd "$BASE_DIR" && find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    lines=$(wc -l < "$file" 2>/dev/null || echo 0)
    functions=$(grep -E "(function|const.*=.*=>|class )" "$file" 2>/dev/null | wc -l || echo 0)
    if [ "$functions" -gt 0 ]; then
        ratio=$((lines / functions))
        if [ "$ratio" -gt 20 ]; then
            echo "⚠️  $file - Ratio: $ratio (${lines}L/${functions}F)"
        fi
    fi
done | sort -t':' -k2 -nr | head -10 >> "$OUTPUT_FILE"

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Duplicate code detection
echo "### 🔄 Potential Duplicates" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Files with similar names (potential duplicates):" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

cd "$BASE_DIR/src" && find . -name "*.ts" -o -name "*.tsx" | \
    sed 's/.*\///' | sort | uniq -d | head -10 >> "$OUTPUT_FILE" || echo "No duplicates found"

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Import health
echo "### 📦 Import Health" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Files with excessive imports (>15):" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

cd "$BASE_DIR" && find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    import_count=$(grep -c "^import" "$file" 2>/dev/null || echo 0)
    if [ "$import_count" -gt 15 ]; then
        echo "⚠️  $file - $import_count imports"
    fi
done | sort -t'-' -k2 -nr | head -10 >> "$OUTPUT_FILE"

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# File size analysis
echo "### 📄 Large Files" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Files larger than 300 lines:" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

cd "$BASE_DIR" && find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    lines=$(wc -l < "$file" 2>/dev/null || echo 0)
    if [ "$lines" -gt 300 ]; then
        echo "⚠️  $file - $lines lines"
    fi
done | sort -t'-' -k2 -nr | head -10 >> "$OUTPUT_FILE"

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Comment coverage
echo "### 💬 Documentation Coverage" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Files with low comment density (<5%):" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

cd "$BASE_DIR" && find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    total_lines=$(wc -l < "$file" 2>/dev/null || echo 1)
    comment_lines=$(grep -E "^\s*(//|/\*|\*)" "$file" 2>/dev/null | wc -l || echo 0)
    if [ "$total_lines" -gt 50 ]; then
        percentage=$((comment_lines * 100 / total_lines))
        if [ "$percentage" -lt 5 ]; then
            echo "📝 $file - $percentage% comments"
        fi
    fi
done | sort -t'-' -k2 -n | head -10 >> "$OUTPUT_FILE"

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Test coverage gaps
echo "### 🧪 Test Coverage Gaps" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Components/Services without tests:" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

cd "$BASE_DIR/src" && find . -name "*.tsx" -o -name "*.ts" | grep -v ".test" | while read -r file; do
    base_name=$(basename "$file" | sed 's/\.[^.]*$//')
    dir_name=$(dirname "$file")
    if ! find "$dir_name" -name "${base_name}.test.*" 2>/dev/null | grep -q .; then
        if [[ "$file" =~ (Screen|Component|Service|Hook) ]]; then
            echo "❌ $file - No test file found"
        fi
    fi
done | head -10 >> "$OUTPUT_FILE"

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Performance hints
echo "### ⚡ Performance Opportunities" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Potential optimization targets:" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

# Check for console.logs
CONSOLE_LOGS=$(cd "$BASE_DIR" && grep -r "console\." --include="*.ts" --include="*.tsx" src/ 2>/dev/null | grep -v "test" | wc -l || echo 0)
echo "- Console statements in production code: $CONSOLE_LOGS" >> "$OUTPUT_FILE"

# Check for any/unknown types
ANY_TYPES=$(cd "$BASE_DIR" && grep -r ": any\|: unknown" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | wc -l || echo 0)
echo "- Uses of 'any' or 'unknown' types: $ANY_TYPES" >> "$OUTPUT_FILE"

# Check for inline styles
INLINE_STYLES=$(cd "$BASE_DIR" && grep -r "style={{" --include="*.tsx" src/ 2>/dev/null | wc -l || echo 0)
echo "- Inline styles in components: $INLINE_STYLES" >> "$OUTPUT_FILE"

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Recommendations
cat >> "$OUTPUT_FILE" << 'EOF'
## 💡 Recommendations

### Immediate Actions
1. Fix all TypeScript errors
2. Address security vulnerabilities with `npm audit fix`
3. Add tests for untested components
4. Refactor files with high complexity

### Short-term Improvements
1. Reduce file sizes by splitting large components
2. Add JSDoc comments to public APIs
3. Remove or implement TODO items
4. Optimize bundle size

### Long-term Goals
1. Achieve >80% test coverage
2. Implement automated code quality checks
3. Set up continuous integration
4. Regular dependency updates

## 🔧 Helpful Commands

```bash
# Fix TypeScript errors
npm run tsc -- --noEmit

# Fix linting issues
npm run lint -- --fix

# Run tests with coverage
npm test -- --coverage

# Analyze bundle size
npm run build && npm run analyze

# Find unused code
npx unimported
```

## 📈 Progress Tracking

Track these metrics over time:
- Health Score
- TypeScript Errors
- Test Coverage
- Bundle Size
- Performance Metrics

EOF

echo -e "${GREEN}✓ Code health check complete: $OUTPUT_FILE${NC}"
echo -e "${YELLOW}Health Score: $HEALTH_SCORE/100${NC}"
echo -e "${YELLOW}View full report: cat $OUTPUT_FILE${NC}" 