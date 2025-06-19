#!/bin/bash

# Dependency Analysis Script
# Analyzes project dependencies and their relationships

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_FILE="$BASE_DIR/.context/dependency-analysis.md"

echo -e "${BLUE}🔍 Analyzing dependencies...${NC}"

# Start the analysis file
cat > "$OUTPUT_FILE" << EOF
# Dependency Analysis Report

Generated: $(date)

## 📦 Direct Dependencies

EOF

# Analyze package.json dependencies
echo "### Production Dependencies" >> "$OUTPUT_FILE"
echo '```json' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && cat package.json | jq '.dependencies' 2>/dev/null >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Development Dependencies" >> "$OUTPUT_FILE"
echo '```json' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && cat package.json | jq '.devDependencies' 2>/dev/null >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Check for outdated packages
echo "## 🔄 Outdated Packages" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && npm outdated 2>/dev/null >> "$OUTPUT_FILE" || echo "All packages up to date"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Analyze import statements
echo "## 📊 Import Analysis" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Count imports by package
echo "### Most Used External Packages" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && grep -r "import.*from ['\"]" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | \
  grep -v "from ['\"]\./" | \
  sed -E "s/.*from ['\"](@?[^/'\"]+).*/\1/" | \
  sort | uniq -c | sort -nr | head -15 >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Internal module dependencies
echo "### Internal Module Dependencies" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    imports=$(grep -E "import.*from ['\"]\./" "$file" 2>/dev/null | wc -l || echo 0)
    if [ "$imports" -gt 0 ]; then
        echo "$imports imports: $file"
    fi
done | sort -nr | head -10 >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Circular dependency check
echo "## 🔄 Potential Circular Dependencies" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "Checking for files that import each other..." >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

# Simple circular dependency detection
cd "$BASE_DIR/src" && find . -name "*.ts" -o -name "*.tsx" | while read -r file1; do
    grep -l "from.*$(basename "$file1" | sed 's/\.[^.]*$//')" . -r --include="*.ts" --include="*.tsx" 2>/dev/null | while read -r file2; do
        if [ "$file1" != "$file2" ] && grep -q "from.*$(basename "$file2" | sed 's/\.[^.]*$//')" "$file1" 2>/dev/null; then
            echo "Potential circular: $file1 <-> $file2"
        fi
    done
done | sort -u | head -5 >> "$OUTPUT_FILE" || echo "No circular dependencies detected"

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Bundle size analysis
echo "## 📏 Bundle Size Impact" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "### Estimated sizes of key dependencies:" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "| Package | Version | Size (approx) |" >> "$OUTPUT_FILE"
echo "|---------|---------|---------------|" >> "$OUTPUT_FILE"

# Check sizes of major dependencies
for pkg in "react" "react-dom" "next" "@solana/web3.js" "zustand"; do
    if grep -q "\"$pkg\"" "$BASE_DIR/package.json"; then
        version=$(cat "$BASE_DIR/package.json" | jq -r ".dependencies[\"$pkg\"] // .devDependencies[\"$pkg\"]" 2>/dev/null)
        # Rough size estimation based on node_modules
        if [ -d "$BASE_DIR/node_modules/$pkg" ]; then
            size=$(du -sh "$BASE_DIR/node_modules/$pkg" 2>/dev/null | awk '{print $1}')
            echo "| $pkg | $version | $size |" >> "$OUTPUT_FILE"
        fi
    fi
done

echo "" >> "$OUTPUT_FILE"

# Security audit summary
echo "## 🔒 Security Audit Summary" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
cd "$BASE_DIR" && npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities' >> "$OUTPUT_FILE" || echo "Unable to run security audit"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Recommendations
cat >> "$OUTPUT_FILE" << 'EOF'
## 💡 Recommendations

### To reduce bundle size:
1. Use dynamic imports for large components
2. Tree-shake unused exports
3. Consider lighter alternatives for heavy dependencies

### To improve maintainability:
1. Keep dependencies up to date
2. Remove unused dependencies
3. Document why each dependency is needed

### To enhance security:
1. Run `npm audit fix` regularly
2. Review dependency licenses
3. Use lock files consistently

## 🔧 Useful Commands

```bash
# Check bundle size
npm run build && npm run analyze

# Update dependencies safely
npm update --save

# Check for unused dependencies
npx depcheck

# Visualize dependency tree
npm ls --depth=2
```
EOF

echo -e "${GREEN}✓ Dependency analysis complete: $OUTPUT_FILE${NC}"
echo -e "${YELLOW}View report: cat $OUTPUT_FILE${NC}" 