#!/bin/bash

# Find Related Files Script
# Finds all files related to a specific component, service, or feature

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Check if search term is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Please specify what to search for${NC}"
    echo "Usage: $0 <search-term>"
    echo "Examples:"
    echo "  $0 MessageBus"
    echo "  $0 ChatThreadScreen"
    echo "  $0 storage"
    exit 1
fi

SEARCH_TERM=$1
OUTPUT_FILE="$BASE_DIR/.context/related-${SEARCH_TERM//\//-}.md"

echo -e "${BLUE}🔍 Finding files related to '${SEARCH_TERM}'...${NC}"

# Start the report
cat > "$OUTPUT_FILE" << EOF
# Related Files: ${SEARCH_TERM}

Generated: $(date)

## 🎯 Search Term: \`${SEARCH_TERM}\`

EOF

# Direct file matches
echo "## 📄 Direct File Matches" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && find src -type f \( -name "*${SEARCH_TERM}*" \) 2>/dev/null | head -20 >> "$OUTPUT_FILE" || echo "No direct file matches"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Import/Export analysis
echo "## 📦 Import/Export Analysis" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Files that import '${SEARCH_TERM}'" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -r "import.*${SEARCH_TERM}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    cut -d: -f1 | sort -u | head -15 >> "$OUTPUT_FILE" || echo "No imports found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Files that export '${SEARCH_TERM}'" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -r "export.*${SEARCH_TERM}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    cut -d: -f1 | sort -u | head -10 >> "$OUTPUT_FILE" || echo "No exports found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Usage analysis
echo "## 🔧 Usage Analysis" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Direct usage (function calls, instantiation)" >> "$OUTPUT_FILE"
echo '```typescript' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -rn "${SEARCH_TERM}\." src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "import\|export" | head -15 >> "$OUTPUT_FILE" || \
    grep -rn "new ${SEARCH_TERM}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -15 >> "$OUTPUT_FILE" || \
    echo "No direct usage found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Type usage
echo "### Type/Interface usage" >> "$OUTPUT_FILE"
echo '```typescript' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -rn ": ${SEARCH_TERM}\|<${SEARCH_TERM}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "import\|export" | head -10 >> "$OUTPUT_FILE" || echo "No type usage found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Test files
echo "## 🧪 Test Files" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && find src -name "*.test.ts" -o -name "*.test.tsx" | \
    xargs grep -l "${SEARCH_TERM}" 2>/dev/null | head -10 >> "$OUTPUT_FILE" || echo "No test files found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Related patterns
echo "## 🔗 Related Patterns" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Find similar named items
SIMILAR_TERMS=$(echo "$SEARCH_TERM" | sed 's/Screen$//' | sed 's/Service$//' | sed 's/Component$//')
if [ "$SIMILAR_TERMS" != "$SEARCH_TERM" ]; then
    echo "### Similar components/services" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
    cd "$BASE_DIR" && find src -type f -name "*${SIMILAR_TERMS}*" 2>/dev/null | \
        grep -v "$SEARCH_TERM" | head -10 >> "$OUTPUT_FILE" || echo "No similar files found"
    echo '```' >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

# Documentation references
echo "## 📚 Documentation References" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -r "${SEARCH_TERM}" .context/ *.md docs/ 2>/dev/null | \
    grep -v "related-${SEARCH_TERM}" | head -10 >> "$OUTPUT_FILE" || echo "No documentation references found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Call hierarchy
echo "## 🌳 Call Hierarchy" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Functions/Methods in ${SEARCH_TERM}" >> "$OUTPUT_FILE"
echo '```typescript' >> "$OUTPUT_FILE"

# Find the main file
MAIN_FILE=$(cd "$BASE_DIR" && find src -name "${SEARCH_TERM}.ts" -o -name "${SEARCH_TERM}.tsx" 2>/dev/null | head -1)
if [ -n "$MAIN_FILE" ]; then
    cd "$BASE_DIR" && grep -E "^\s*(export\s+)?(async\s+)?function|^\s*(export\s+)?const.*=.*=>|^\s*public|^\s*private" "$MAIN_FILE" 2>/dev/null | \
        sed 's/^\s*//' | head -15 >> "$OUTPUT_FILE"
else
    echo "Main file not found" >> "$OUTPUT_FILE"
fi

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Summary statistics
echo "## 📊 Summary" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

IMPORT_COUNT=$(cd "$BASE_DIR" && grep -r "import.*${SEARCH_TERM}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
USAGE_COUNT=$(cd "$BASE_DIR" && grep -r "${SEARCH_TERM}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
FILE_COUNT=$(cd "$BASE_DIR" && find src -type f -name "*${SEARCH_TERM}*" 2>/dev/null | wc -l || echo 0)

echo "| Metric | Count |" >> "$OUTPUT_FILE"
echo "|--------|-------|" >> "$OUTPUT_FILE"
echo "| Files with name match | $FILE_COUNT |" >> "$OUTPUT_FILE"
echo "| Import statements | $IMPORT_COUNT |" >> "$OUTPUT_FILE"
echo "| Total references | $USAGE_COUNT |" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Visualization
echo "## 🗺️ Dependency Map" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "```mermaid" >> "$OUTPUT_FILE"
echo "graph TD" >> "$OUTPUT_FILE"

# Simple dependency visualization
echo "    ${SEARCH_TERM}[${SEARCH_TERM}]" >> "$OUTPUT_FILE"

# Find direct importers
cd "$BASE_DIR" && grep -r "import.*${SEARCH_TERM}" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
    cut -d: -f1 | sort -u | head -5 | while read -r file; do
    component=$(basename "$file" | sed 's/\.[^.]*$//')
    echo "    $component --> ${SEARCH_TERM}" >> "$OUTPUT_FILE"
done

# Find what this imports
if [ -n "$MAIN_FILE" ]; then
    cd "$BASE_DIR" && grep "^import" "$MAIN_FILE" 2>/dev/null | \
        sed -E "s/.*from ['\"]\.\/([^'\"]+).*/\1/" | \
        grep -v "^import" | head -5 | while read -r import; do
        echo "    ${SEARCH_TERM} --> $import" >> "$OUTPUT_FILE"
    done
fi

echo "```" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Recommendations
cat >> "$OUTPUT_FILE" << EOF
## 💡 Next Steps

1. **Review Dependencies**: Check if all imports are necessary
2. **Test Coverage**: Ensure related test files exist
3. **Documentation**: Update if relationships have changed
4. **Refactoring**: Consider if the component has too many dependencies

## 🔧 Useful Commands

\`\`\`bash
# View the main file
cat src/path/to/${SEARCH_TERM}.ts

# Run related tests
npm test -- ${SEARCH_TERM}

# Check for circular dependencies
npm run check-circular
\`\`\`

EOF

echo -e "${GREEN}✓ Related files analysis complete: $OUTPUT_FILE${NC}"
echo -e "${YELLOW}Found $IMPORT_COUNT imports and $USAGE_COUNT total references${NC}"
echo -e "${YELLOW}View report: cat $OUTPUT_FILE${NC}" 