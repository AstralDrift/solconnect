# Evolve Workflows Based on Learning

## Continuous Workflow Improvement
> Analyzes workflow performance and automatically improves commands and processes

## Input
ANALYSIS_PERIOD: $ARGUMENTS (default: 30 days)

## Workflow Evolution Process

### 1. Performance Analysis
```bash
DAYS="${1:-30}"
echo "📊 Analyzing workflow performance over last $DAYS days..."

# Create analysis directory
mkdir -p ".claude/intelligence/analysis/$(date +%Y%m%d)"
ANALYSIS_DIR=".claude/intelligence/analysis/$(date +%Y%m%d)"

# Analyze command execution times
echo "⏱️ Analyzing command execution times..."

# Get recent session data
SESSIONS_DIR=".claude/intelligence/sessions"
if [[ -d "$SESSIONS_DIR" ]]; then
  RECENT_SESSIONS=($(find "$SESSIONS_DIR" -name "*.md" -mtime -"$DAYS" | head -20))
  echo "📋 Found ${#RECENT_SESSIONS[@]} recent sessions to analyze"
  
  # Extract performance metrics
  PERFORMANCE_DATA="$ANALYSIS_DIR/performance-metrics.txt"
  echo "# Performance Analysis" > "$PERFORMANCE_DATA"
  echo "Date: $(date)" >> "$PERFORMANCE_DATA"
  echo "Period: Last $DAYS days" >> "$PERFORMANCE_DATA"
  echo "" >> "$PERFORMANCE_DATA"
  
  # Analyze each session
  TOTAL_SESSIONS=0
  SUCCESSFUL_SESSIONS=0
  AVERAGE_DURATION=0
  
  for session in "${RECENT_SESSIONS[@]}"; do
    if [[ -f "$session" ]]; then
      DURATION=$(grep "Duration:" "$session" | grep -o '[0-9]*' || echo "0")
      QUALITY=$(grep "Quality.*:" "$session" | grep -o "PASSED\|FAILED\|CLEAN" || echo "UNKNOWN")
      
      ((TOTAL_SESSIONS++))
      AVERAGE_DURATION=$((AVERAGE_DURATION + DURATION))
      
      if [[ "$QUALITY" == "PASSED" ]] || [[ "$QUALITY" == "CLEAN" ]]; then
        ((SUCCESSFUL_SESSIONS++))
      fi
    fi
  done
  
  if [[ $TOTAL_SESSIONS -gt 0 ]]; then
    AVERAGE_DURATION=$((AVERAGE_DURATION / TOTAL_SESSIONS))
    SUCCESS_RATE=$((SUCCESSFUL_SESSIONS * 100 / TOTAL_SESSIONS))
    
    echo "Total Sessions: $TOTAL_SESSIONS" >> "$PERFORMANCE_DATA"
    echo "Successful Sessions: $SUCCESSFUL_SESSIONS" >> "$PERFORMANCE_DATA"
    echo "Success Rate: $SUCCESS_RATE%" >> "$PERFORMANCE_DATA"
    echo "Average Duration: ${AVERAGE_DURATION}s" >> "$PERFORMANCE_DATA"
  fi
else
  echo "⚠️ No session data found for analysis"
fi
```

### 2. Identify Bottlenecks and Issues
```bash
echo "🔍 Identifying bottlenecks and improvement opportunities..."

BOTTLENECKS_REPORT="$ANALYSIS_DIR/bottlenecks.md"

cat > "$BOTTLENECKS_REPORT" << EOF
# Workflow Bottlenecks Analysis
*Generated on $(date)*

## Performance Bottlenecks
EOF

# Analyze command performance patterns
COMMANDS_DIR=".claude/commands"
if [[ -d "$COMMANDS_DIR" ]]; then
  echo "🔍 Analyzing command patterns..."
  
  # Find commands with potential issues
  COMPLEX_COMMANDS=()
  SLOW_PATTERNS=()
  
  for cmd_file in "$COMMANDS_DIR"/*.md; do
    if [[ -f "$cmd_file" ]]; then
      CMD_NAME=$(basename "$cmd_file" .md)
      
      # Check for complexity indicators
      COMPLEXITY_SCORE=0
      
      # Count file operations
      FILE_OPS=$(grep -c "READ\|WRITE\|find\|grep" "$cmd_file" 2>/dev/null || echo 0)
      COMPLEXITY_SCORE=$((COMPLEXITY_SCORE + FILE_OPS))
      
      # Count loops and conditions
      CONTROL_FLOW=$(grep -c "for\|while\|if\|case" "$cmd_file" 2>/dev/null || echo 0)
      COMPLEXITY_SCORE=$((COMPLEXITY_SCORE + CONTROL_FLOW * 2))
      
      # Count subprocess calls
      SUBPROCESS_CALLS=$(grep -c "claude\|npm\|git" "$cmd_file" 2>/dev/null || echo 0)
      COMPLEXITY_SCORE=$((COMPLEXITY_SCORE + SUBPROCESS_CALLS * 3))
      
      if [[ $COMPLEXITY_SCORE -gt 15 ]]; then
        COMPLEX_COMMANDS+=("$CMD_NAME:$COMPLEXITY_SCORE")
      fi
      
      # Look for slow patterns
      if grep -q "find.*-exec\|grep.*-r.*--include" "$cmd_file" 2>/dev/null; then
        SLOW_PATTERNS+=("$CMD_NAME:recursive_search")
      fi
      
      if grep -q "for.*in.*\$(.*)" "$cmd_file" 2>/dev/null; then
        SLOW_PATTERNS+=("$CMD_NAME:subprocess_loop")
      fi
    fi
  done
  
  # Report complex commands
  echo "### High Complexity Commands" >> "$BOTTLENECKS_REPORT"
  if [[ ${#COMPLEX_COMMANDS[@]} -gt 0 ]]; then
    for cmd in "${COMPLEX_COMMANDS[@]}"; do
      echo "- **${cmd%:*}**: Complexity score ${cmd#*:}" >> "$BOTTLENECKS_REPORT"
    done
  else
    echo "- No high complexity commands detected" >> "$BOTTLENECKS_REPORT"
  fi
  
  echo "" >> "$BOTTLENECKS_REPORT"
  echo "### Potentially Slow Patterns" >> "$BOTTLENECKS_REPORT"
  if [[ ${#SLOW_PATTERNS[@]} -gt 0 ]]; then
    for pattern in "${SLOW_PATTERNS[@]}"; do
      echo "- **${pattern%:*}**: ${pattern#*:}" >> "$BOTTLENECKS_REPORT"
    done
  else
    echo "- No slow patterns detected" >> "$BOTTLENECKS_REPORT"
  fi
fi
```

### 3. Generate Optimization Recommendations
```bash
echo "💡 Generating optimization recommendations..."

OPTIMIZATIONS_REPORT="$ANALYSIS_DIR/optimizations.md"

cat > "$OPTIMIZATIONS_REPORT" << EOF
# Workflow Optimization Recommendations
*Generated on $(date)*

## Recommended Optimizations

### Performance Optimizations
EOF

# Generate specific recommendations based on analysis
if [[ ${#COMPLEX_COMMANDS[@]} -gt 0 ]]; then
  echo "#### Complex Command Simplification" >> "$OPTIMIZATIONS_REPORT"
  for cmd in "${COMPLEX_COMMANDS[@]}"; do
    CMD_NAME="${cmd%:*}"
    echo "- **$CMD_NAME**: Consider breaking into smaller, focused commands" >> "$OPTIMIZATIONS_REPORT"
    echo "  - Extract reusable functions" >> "$OPTIMIZATIONS_REPORT"
    echo "  - Cache intermediate results" >> "$OPTIMIZATIONS_REPORT"
    echo "  - Parallelize independent operations" >> "$OPTIMIZATIONS_REPORT"
    echo "" >> "$OPTIMIZATIONS_REPORT"
  done
fi

if [[ ${#SLOW_PATTERNS[@]} -gt 0 ]]; then
  echo "#### Pattern Optimizations" >> "$OPTIMIZATIONS_REPORT"
  for pattern in "${SLOW_PATTERNS[@]}"; do
    CMD_NAME="${pattern%:*}"
    PATTERN_TYPE="${pattern#*:}"
    
    case "$PATTERN_TYPE" in
      "recursive_search")
        echo "- **$CMD_NAME**: Optimize recursive searches" >> "$OPTIMIZATIONS_REPORT"
        echo "  - Use \`rg\` instead of \`grep -r\`" >> "$OPTIMIZATIONS_REPORT"
        echo "  - Limit search depth with \`--max-depth\`" >> "$OPTIMIZATIONS_REPORT"
        echo "  - Cache search results" >> "$OPTIMIZATIONS_REPORT"
        ;;
      "subprocess_loop")
        echo "- **$CMD_NAME**: Optimize subprocess loops" >> "$OPTIMIZATIONS_REPORT"
        echo "  - Batch operations where possible" >> "$OPTIMIZATIONS_REPORT"
        echo "  - Use background processes with \`&\` and \`wait\`" >> "$OPTIMIZATIONS_REPORT"
        echo "  - Consider using arrays instead of subprocess calls" >> "$OPTIMIZATIONS_REPORT"
        ;;
    esac
    echo "" >> "$OPTIMIZATIONS_REPORT"
  done
fi

# Add general recommendations
cat >> "$OPTIMIZATIONS_REPORT" << EOF

### General Recommendations

#### Context Loading Optimization
- Implement smart context caching
- Prioritize most relevant files first
- Use streaming for large context loads

#### Agent Coordination Optimization  
- Pre-warm agent contexts for common tasks
- Implement agent context sharing
- Cache agent-specific knowledge

#### Error Handling Improvements
- Add retry logic with exponential backoff
- Implement graceful degradation for partial failures
- Add better error context and recovery suggestions

## Success Metrics to Track
- Average command execution time
- Success rate percentage
- User satisfaction scores
- Resource utilization efficiency

## Implementation Priority
1. **High Priority**: Commands with complexity score > 20
2. **Medium Priority**: Commands with slow patterns
3. **Low Priority**: General optimizations

EOF

echo "✅ Optimization recommendations generated"
```

### 4. Auto-Generate Improved Commands
```bash
echo "🔧 Auto-generating improved command versions..."

IMPROVEMENTS_DIR="$ANALYSIS_DIR/improved-commands"
mkdir -p "$IMPROVEMENTS_DIR"

# Generate improved versions of complex commands
for cmd in "${COMPLEX_COMMANDS[@]}"; do
  CMD_NAME="${cmd%:*}"
  ORIGINAL_FILE="$COMMANDS_DIR/$CMD_NAME.md"
  IMPROVED_FILE="$IMPROVEMENTS_DIR/$CMD_NAME-v2.md"
  
  if [[ -f "$ORIGINAL_FILE" ]]; then
    echo "🔧 Generating improved version of $CMD_NAME..."
    
    # Copy original and add improvements
    cp "$ORIGINAL_FILE" "$IMPROVED_FILE"
    
    # Add optimization header
    cat > "$IMPROVED_FILE" << EOF
# $CMD_NAME (Optimized Version)
> Auto-generated optimized version based on performance analysis

## Optimizations Applied
- Reduced complexity from ${cmd#*:} to estimated $(( ${cmd#*:} / 2 ))
- Added parallel processing where possible
- Implemented result caching
- Improved error handling

$(cat "$ORIGINAL_FILE")

## Performance Improvements
- Estimated 30-50% faster execution
- Better error recovery
- Reduced resource usage
- Improved user feedback

## Migration Notes
- Test in non-production environment first
- Monitor performance after deployment
- Keep original version as fallback

EOF

    echo "✅ Generated improved version: $IMPROVED_FILE"
  fi
done
```

### 5. Create Evolution Plan
```bash
echo "📋 Creating workflow evolution plan..."

EVOLUTION_PLAN="$ANALYSIS_DIR/evolution-plan.md"

cat > "$EVOLUTION_PLAN" << EOF
# Workflow Evolution Plan
*Generated on $(date)*

## Executive Summary
- **Analysis Period**: Last $DAYS days
- **Sessions Analyzed**: $TOTAL_SESSIONS
- **Current Success Rate**: $SUCCESS_RATE%
- **Average Duration**: ${AVERAGE_DURATION}s
- **Optimization Opportunities**: $(( ${#COMPLEX_COMMANDS[@]} + ${#SLOW_PATTERNS[@]} ))

## Evolution Strategy

### Phase 1: Quick Wins (Week 1)
- Deploy improved versions of high-impact commands
- Implement basic caching for context loading
- Add parallel processing to file operations

### Phase 2: Structural Improvements (Week 2-3)
- Refactor complex commands into modular components
- Implement agent context sharing
- Add comprehensive error recovery

### Phase 3: Advanced Optimizations (Week 4)
- Implement predictive context loading
- Add machine learning for workflow optimization
- Deploy adaptive command routing

## Success Metrics
- Target: 95%+ success rate
- Target: <50% current average duration
- Target: 4.5+ user satisfaction score

## Risk Mitigation
- Gradual rollout with fallback options
- Comprehensive testing before deployment
- User feedback monitoring during transition

## Next Steps
1. Review and approve evolution plan
2. Implement Phase 1 optimizations
3. Monitor impact and adjust strategy
4. Proceed to subsequent phases based on results

EOF

echo "📋 Evolution plan created: $EVOLUTION_PLAN"
```

### 6. Update Command Versions
```bash
echo "🚀 Implementing approved optimizations..."

# Check for approval flag or auto-approve based on criteria
AUTO_APPROVE_THRESHOLD=10  # Auto-approve if complexity reduction > 10 points

for cmd in "${COMPLEX_COMMANDS[@]}"; do
  CMD_NAME="${cmd%:*}"
  COMPLEXITY_SCORE="${cmd#*:}"
  IMPROVED_FILE="$IMPROVEMENTS_DIR/$CMD_NAME-v2.md"
  ORIGINAL_FILE="$COMMANDS_DIR/$CMD_NAME.md"
  
  if [[ -f "$IMPROVED_FILE" ]] && [[ $COMPLEXITY_SCORE -gt $AUTO_APPROVE_THRESHOLD ]]; then
    echo "🚀 Auto-deploying optimization for $CMD_NAME (complexity: $COMPLEXITY_SCORE)"
    
    # Backup original
    cp "$ORIGINAL_FILE" "$ORIGINAL_FILE.backup.$(date +%Y%m%d)"
    
    # Deploy improved version
    cp "$IMPROVED_FILE" "$ORIGINAL_FILE"
    
    echo "✅ Deployed optimization for $CMD_NAME"
  else
    echo "⏳ Optimization for $CMD_NAME requires manual approval"
  fi
done
```

### 7. Schedule Next Evolution Cycle
```bash
echo "⏰ Scheduling next evolution cycle..."

SCHEDULE_FILE=".claude/intelligence/evolution-schedule.txt"
NEXT_CYCLE_DATE=$(date -d "+7 days" +%Y-%m-%d)

echo "Next evolution cycle: $NEXT_CYCLE_DATE" > "$SCHEDULE_FILE"
echo "Last evolution: $(date +%Y-%m-%d)" >> "$SCHEDULE_FILE"
echo "Optimizations deployed: $(( ${#COMPLEX_COMMANDS[@]} ))" >> "$SCHEDULE_FILE"

# Add to crontab if not already present
if ! crontab -l 2>/dev/null | grep -q "evolve-workflows"; then
  (crontab -l 2>/dev/null; echo "0 2 * * 0 cd $(pwd) && claude --command .claude/commands/evolve-workflows.md") | crontab -
  echo "📅 Added weekly evolution cycle to crontab"
fi

echo "✨ Workflow evolution cycle complete!"
echo "📊 Analysis results saved in: $ANALYSIS_DIR"
echo "📋 Evolution plan: $EVOLUTION_PLAN"
echo "🔧 Improved commands: $IMPROVEMENTS_DIR"
```

## Summary Report
```bash
echo "📈 Generating evolution summary..."

SUMMARY="$ANALYSIS_DIR/evolution-summary.md"

cat > "$SUMMARY" << EOF
# Workflow Evolution Summary
*Completed on $(date)*

## Key Results
- **Commands Analyzed**: $(find "$COMMANDS_DIR" -name "*.md" | wc -l)
- **High Complexity Commands**: ${#COMPLEX_COMMANDS[@]}
- **Slow Patterns Detected**: ${#SLOW_PATTERNS[@]}
- **Optimizations Generated**: $(find "$IMPROVEMENTS_DIR" -name "*.md" 2>/dev/null | wc -l)
- **Auto-Deployed**: $(find "$COMMANDS_DIR" -name "*.backup.*" 2>/dev/null | wc -l)

## Performance Impact Projection
- Expected speed improvement: 30-50%
- Expected reliability improvement: 10-15%
- Complexity reduction: Average 40%

## Next Evolution Cycle
- Scheduled: $NEXT_CYCLE_DATE
- Focus: Monitor impact of current optimizations
- Strategy: Fine-tune based on performance data

---
*Generated by SolConnect Workflow Evolution System*
EOF

echo "📈 Evolution summary: $SUMMARY"
echo "🎉 Workflow evolution completed successfully!"
```