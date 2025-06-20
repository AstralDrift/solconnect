# Evaluate Parallel Implementations and Create Hybrid

## Input
FEATURE_NAME: $ARGUMENTS

## Process

### 1. Collect Implementation Results
```bash
echo "📊 Collecting results from parallel implementations..."

# Gather results from each implementation
for i in {1..3}; do
  WORKSPACE="dev-trees/${FEATURE_NAME}-v${i}"
  echo "=== Team ${i} Results ===" 
  
  if [[ -f "$WORKSPACE/RESULTS.md" ]]; then
    echo "✅ Team ${i} completed implementation"
    cat "$WORKSPACE/RESULTS.md"
  else
    echo "❌ Team ${i} did not complete implementation"
  fi
  echo "---"
done
```

### 2. Run Comparative Validation
```bash
echo "🔍 Running validation on each implementation..."

VALIDATION_RESULTS=()
for i in {1..3}; do
  WORKSPACE="dev-trees/${FEATURE_NAME}-v${i}"
  if [[ -d "$WORKSPACE" ]]; then
    cd "$WORKSPACE"
    
    # Run validation and capture results
    RESULT=$(claude --command .claude/commands/validate-implementation.md 2>&1)
    VALIDATION_RESULTS[$i]="$RESULT"
    
    # Extract key metrics
    TESTS_PASS=$(echo "$RESULT" | grep -o "tests.*passed" || echo "0 tests passed")
    LINT_ERRORS=$(echo "$RESULT" | grep -o "[0-9]* errors" || echo "0 errors")
    BUILD_STATUS=$(echo "$RESULT" | grep -o "build.*success\|build.*failed" || echo "build unknown")
    
    echo "Team ${i}: $TESTS_PASS, $LINT_ERRORS, $BUILD_STATUS"
    cd - > /dev/null
  fi
done
```

### 3. Performance Benchmarking
```bash
echo "⚡ Running performance benchmarks..."

for i in {1..3}; do
  WORKSPACE="dev-trees/${FEATURE_NAME}-v${i}"
  if [[ -d "$WORKSPACE" ]]; then
    cd "$WORKSPACE"
    
    # Run feature-specific benchmarks
    if [[ -f "package.json" ]] && grep -q "benchmark" package.json; then
      echo "Team ${i} benchmark results:"
      npm run benchmark 2>/dev/null || echo "Benchmark failed"
    fi
    
    # Check bundle size impact
    if [[ -f ".next/build-manifest.json" ]]; then
      BUNDLE_SIZE=$(du -sh .next/static 2>/dev/null | cut -f1 || echo "unknown")
      echo "Team ${i} bundle size: $BUNDLE_SIZE"
    fi
    
    cd - > /dev/null
  fi
done
```

### 4. Code Quality Analysis
```typescript
// Analyze each implementation for code quality metrics
interface ImplementationMetrics {
  testCoverage: number;
  lintErrors: number;
  typeErrors: number;
  bundleSize: string;
  performance: {
    responseTime: number;
    memoryUsage: number;
  };
  codeQuality: {
    complexity: number;
    maintainability: number;
    documentation: number;
  };
}

function analyzeImplementation(workspace: string): ImplementationMetrics {
  // Extract metrics from validation results
  return {
    testCoverage: extractTestCoverage(workspace),
    lintErrors: extractLintErrors(workspace), 
    typeErrors: extractTypeErrors(workspace),
    bundleSize: extractBundleSize(workspace),
    performance: extractPerformanceMetrics(workspace),
    codeQuality: extractCodeQualityMetrics(workspace)
  };
}
```

### 5. Create Evaluation Matrix
```bash
echo "📈 Creating evaluation matrix..."

cat > evaluation-matrix.md << EOF
# ${FEATURE_NAME} Implementation Evaluation

| Metric | Team 1 | Team 2 | Team 3 | Weight |
|--------|--------|--------|--------|---------|
| Tests Pass | ${TEAM1_TESTS} | ${TEAM2_TESTS} | ${TEAM3_TESTS} | 25% |
| Code Quality | ${TEAM1_QUALITY} | ${TEAM2_QUALITY} | ${TEAM3_QUALITY} | 25% |
| Performance | ${TEAM1_PERF} | ${TEAM2_PERF} | ${TEAM3_PERF} | 25% |
| Architecture | ${TEAM1_ARCH} | ${TEAM2_ARCH} | ${TEAM3_ARCH} | 25% |

## Detailed Analysis

### Team 1 Strengths:
- ${TEAM1_STRENGTHS}

### Team 2 Strengths:
- ${TEAM2_STRENGTHS}

### Team 3 Strengths:
- ${TEAM3_STRENGTHS}

## Recommended Hybrid Approach:
EOF
```

### 6. Intelligent Component Selection
```bash
echo "🧠 Selecting best components for hybrid implementation..."

# Analyze which team implemented each component best
declare -A BEST_COMPONENTS

# UI Components
UI_SCORES=($(compare_ui_implementations))
BEST_COMPONENTS["ui"]="team-${UI_SCORES[0]}"

# Backend Services  
SERVICE_SCORES=($(compare_service_implementations))
BEST_COMPONENTS["services"]="team-${SERVICE_SCORES[0]}"

# Testing
TEST_SCORES=($(compare_test_implementations))
BEST_COMPONENTS["tests"]="team-${TEST_SCORES[0]}"

echo "Best UI: ${BEST_COMPONENTS[ui]}"
echo "Best Services: ${BEST_COMPONENTS[services]}"
echo "Best Tests: ${BEST_COMPONENTS[tests]}"
```

### 7. Create Hybrid Implementation
```bash
echo "✨ Creating hybrid implementation..."

# Create hybrid directory
mkdir -p "hybrid-${FEATURE_NAME}"
cd "hybrid-${FEATURE_NAME}"

# Copy best components from each team
echo "Copying best UI components from ${BEST_COMPONENTS[ui]}..."
cp -r "../dev-trees/${FEATURE_NAME}-v${BEST_COMPONENTS[ui]:5}/src/components/" ./src/

echo "Copying best services from ${BEST_COMPONENTS[services]}..."  
cp -r "../dev-trees/${FEATURE_NAME}-v${BEST_COMPONENTS[services]:5}/src/services/" ./src/

echo "Copying best tests from ${BEST_COMPONENTS[tests]}..."
cp -r "../dev-trees/${FEATURE_NAME}-v${BEST_COMPONENTS[tests]:5}/src/**/*.test.*" ./src/

# Integration and compatibility fixes
echo "🔧 Fixing integration issues..."
claude --task "Integrate copied components and fix any compatibility issues" \
  --context "Hybrid implementation combining best parts from parallel development"
```

### 8. Final Validation and Integration
```bash
echo "🔍 Final validation of hybrid implementation..."

cd "hybrid-${FEATURE_NAME}"

# Run full validation suite
npm install
npm run lint
npm run typecheck  
npm test
npm run build

# Performance benchmark
npm run benchmark

echo "✅ Hybrid implementation validation complete"
```

### 9. Move to Main Codebase
```bash
echo "📦 Integrating hybrid implementation into main codebase..."

# Copy hybrid implementation to main codebase
rsync -av "hybrid-${FEATURE_NAME}/src/" "../SolConnectApp/src/"

# Final integration test
cd "../SolConnectApp"
npm test
npm run lint
npm run typecheck

echo "🎉 Feature implementation complete!"
```

### 10. Cleanup
```bash
echo "🧹 Cleaning up parallel development artifacts..."

# Remove parallel workspaces
for i in {1..3}; do
  git worktree remove "dev-trees/${FEATURE_NAME}-v${i}" 2>/dev/null || true
done

# Archive evaluation results
mkdir -p ".claude/evaluations/"
mv evaluation-matrix.md ".claude/evaluations/${FEATURE_NAME}-evaluation.md"
mv "hybrid-${FEATURE_NAME}" ".claude/evaluations/"

echo "✨ Cleanup complete. Evaluation archived in .claude/evaluations/"
```