#!/bin/bash

# Subsystem Analysis Script
# Analyzes a specific subsystem in detail for focused development

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Check if subsystem argument is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Please specify a subsystem to analyze${NC}"
    echo "Usage: $0 <subsystem>"
    echo "Available subsystems:"
    echo "  - services    (Core business logic)"
    echo "  - screens     (UI screens)"
    echo "  - components  (Reusable UI components)"
    echo "  - store       (State management)"
    echo "  - hooks       (React hooks)"
    echo "  - transport   (Network layer)"
    echo "  - storage     (Persistence layer)"
    exit 1
fi

SUBSYSTEM=$1
OUTPUT_FILE="$BASE_DIR/.context/subsystem-${SUBSYSTEM}.md"

echo -e "${BLUE}🔍 Analyzing ${SUBSYSTEM} subsystem...${NC}"

# Map subsystem to directory
case $SUBSYSTEM in
    "services")
        TARGET_DIR="src/services"
        ;;
    "screens")
        TARGET_DIR="src/screens"
        ;;
    "components")
        TARGET_DIR="src/components"
        ;;
    "store")
        TARGET_DIR="src/store"
        ;;
    "hooks")
        TARGET_DIR="src/hooks"
        ;;
    "transport")
        TARGET_DIR="src/services/transport"
        ;;
    "storage")
        TARGET_DIR="src/services/storage"
        ;;
    *)
        echo -e "${RED}Unknown subsystem: $SUBSYSTEM${NC}"
        exit 1
        ;;
esac

# Start the analysis file
cat > "$OUTPUT_FILE" << EOF
# Subsystem Analysis: ${SUBSYSTEM}

Generated: $(date)

## 📁 Overview

Analyzing: \`${TARGET_DIR}\`

EOF

# File structure
echo "## 🗂️ File Structure" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && tree "$TARGET_DIR" -I "node_modules|__pycache__|*.pyc" 2>/dev/null || find "$TARGET_DIR" -type f | sort >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Key metrics
echo "## 📊 Metrics" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Metric | Value |" >> "$OUTPUT_FILE"
echo "|--------|-------|" >> "$OUTPUT_FILE"

# Count files
FILE_COUNT=$(find "$BASE_DIR/$TARGET_DIR" -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l || echo 0)
echo "| Total Files | $FILE_COUNT |" >> "$OUTPUT_FILE"

# Count lines
TOTAL_LINES=$(find "$BASE_DIR/$TARGET_DIR" -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs wc -l | tail -1 | awk '{print $1}' || echo 0)
echo "| Total Lines | $TOTAL_LINES |" >> "$OUTPUT_FILE"

# Count test files
TEST_FILES=$(find "$BASE_DIR/$TARGET_DIR" -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | wc -l || echo 0)
echo "| Test Files | $TEST_FILES |" >> "$OUTPUT_FILE"

# Count exports
EXPORT_COUNT=$(grep -r "export" "$BASE_DIR/$TARGET_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo 0)
echo "| Exports | $EXPORT_COUNT |" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"

# Key files analysis
echo "## 🔑 Key Files" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Largest Files" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && find "$TARGET_DIR" -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | sort -nr | head -10 >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Dependencies
echo "## 📦 Dependencies" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### External Dependencies" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -r "import.*from ['\"]" "$TARGET_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | \
    grep -v "from ['\"]\./" | \
    sed -E "s/.*from ['\"](@?[^/'\"]+).*/\1/" | \
    sort | uniq -c | sort -nr | head -15 >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Internal Dependencies" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -r "import.*from ['\"]\./" "$TARGET_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | \
    sed -E "s/.*from ['\"]([^'\"]+).*/\1/" | \
    sort | uniq -c | sort -nr | head -15 >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# API Surface
echo "## 🔌 API Surface" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Exported Functions/Classes" >> "$OUTPUT_FILE"
echo '```typescript' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -r "export.*\(function\|class\|const\|interface\|type\)" "$TARGET_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | \
    sed 's/.*://; s/export default/export/; s/{.*//' | \
    grep -v "^[[:space:]]*$" | \
    sort -u | head -20 >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# TODOs and issues
echo "## 🚧 TODOs and Issues" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -rn "TODO\|FIXME\|HACK\|XXX" "$TARGET_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | head -10 >> "$OUTPUT_FILE" || echo "No TODOs found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Type safety analysis
echo "## 🛡️ Type Safety" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Uses of 'any' type" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -rn ": any" "$TARGET_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null | head -10 >> "$OUTPUT_FILE" || echo "No 'any' types found"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Test coverage
echo "## 🧪 Test Coverage" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Files without tests" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR/$TARGET_DIR" && find . -name "*.ts" -o -name "*.tsx" | grep -v ".test" | while read -r file; do
    base_name=$(basename "$file" | sed 's/\.[^.]*$//')
    dir_name=$(dirname "$file")
    if ! find "$dir_name" -name "${base_name}.test.*" 2>/dev/null | grep -q .; then
        echo "❌ $file"
    fi
done | head -10 >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Recent changes
echo "## 📝 Recent Changes" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Recently modified files" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && find "$TARGET_DIR" -name "*.ts" -o -name "*.tsx" | \
    xargs ls -lt 2>/dev/null | head -10 | awk '{print $9}' >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Subsystem-specific analysis
case $SUBSYSTEM in
    "services")
        echo "## 🔧 Service Analysis" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "### Service Methods" >> "$OUTPUT_FILE"
        echo '```' >> "$OUTPUT_FILE"
        cd "$BASE_DIR" && grep -r "async.*(" "$TARGET_DIR" --include="*.ts" 2>/dev/null | \
            sed 's/.*://; s/{.*//' | grep -v "^[[:space:]]*$" | head -15 >> "$OUTPUT_FILE"
        echo '```' >> "$OUTPUT_FILE"
        ;;
    "screens")
        echo "## 🖥️ Screen Analysis" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "### Screen Components" >> "$OUTPUT_FILE"
        echo '```' >> "$OUTPUT_FILE"
        cd "$BASE_DIR" && grep -r "export.*function.*Screen\|export default.*Screen" "$TARGET_DIR" --include="*.tsx" 2>/dev/null | \
            sed 's/.*://; s/{.*//' >> "$OUTPUT_FILE"
        echo '```' >> "$OUTPUT_FILE"
        ;;
    "components")
        echo "## 🎨 Component Analysis" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "### Component Props" >> "$OUTPUT_FILE"
        echo '```' >> "$OUTPUT_FILE"
        cd "$BASE_DIR" && grep -r "interface.*Props" "$TARGET_DIR" --include="*.tsx" 2>/dev/null | \
            sed 's/.*://' | head -15 >> "$OUTPUT_FILE"
        echo '```' >> "$OUTPUT_FILE"
        ;;
esac

echo "" >> "$OUTPUT_FILE"

# Recommendations
cat >> "$OUTPUT_FILE" << EOF
## 💡 Recommendations

1. **Code Organization**: Check if files are properly organized
2. **Test Coverage**: Add tests for untested files
3. **Type Safety**: Replace 'any' types with proper types
4. **Documentation**: Add JSDoc comments to exported functions
5. **Performance**: Look for optimization opportunities

## 🔗 Related Files

- Full architecture: \`.context/architecture-map.md\`
- Code patterns: \`.context/code-patterns.md\`
- Current work: \`.context/current-work.md\`

EOF

echo -e "${GREEN}✓ Subsystem analysis complete: $OUTPUT_FILE${NC}"
echo -e "${YELLOW}View analysis: cat $OUTPUT_FILE${NC}" 