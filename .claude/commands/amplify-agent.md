# Agent Intelligence Amplification

## Enhanced Agent Context and Guidance
> Provides agents with perfect context, tools, and guidance based on their specialization and task

## Input
AGENT_TYPE: $ARGUMENTS (crypto-specialist, ui-specialist, storage-specialist, network-specialist, message-flow-specialist)
TASK_DESCRIPTION: $ARGUMENTS

## Agent Amplification Process

### 1. Agent Specialization Detection
```bash
AGENT_TYPE="$1"
TASK_DESCRIPTION="$2"

echo "🤖 Amplifying intelligence for: $AGENT_TYPE"
echo "🎯 Task: $TASK_DESCRIPTION"

# Load agent specialization profile
case "$AGENT_TYPE" in
  "crypto-specialist")
    EXPERTISE_AREAS=("encryption" "decryption" "key-management" "wallet-integration" "security")
    FOCUS_FILES=("*crypto*" "*security*" "*wallet*" "*encrypt*")
    RISK_FACTORS=("private-key-exposure" "encryption-weakness" "timing-attacks")
    TOOLS=("crypto-analyzer" "security-scanner" "key-validator")
    ;;
    
  "ui-specialist")
    EXPERTISE_AREAS=("react" "components" "styling" "accessibility" "responsive-design")
    FOCUS_FILES=("*component*" "*.tsx" "*.css" "*style*")
    RISK_FACTORS=("accessibility-violations" "performance-issues" "mobile-incompatibility")
    TOOLS=("a11y-checker" "lighthouse-audit" "responsive-tester")
    ;;
    
  "storage-specialist")
    EXPERTISE_AREAS=("indexeddb" "queries" "migrations" "caching" "data-integrity")
    FOCUS_FILES=("*storage*" "*database*" "*query*" "*migration*")
    RISK_FACTORS=("data-corruption" "migration-failure" "query-performance")
    TOOLS=("query-optimizer" "data-validator" "migration-checker")
    ;;
    
  "network-specialist")
    EXPERTISE_AREAS=("websocket" "connectivity" "offline-sync" "real-time")
    FOCUS_FILES=("*transport*" "*network*" "*relay*" "*sync*")
    RISK_FACTORS=("connection-loss" "sync-conflicts" "race-conditions")
    TOOLS=("network-monitor" "sync-validator" "connection-tester")
    ;;
    
  "message-flow-specialist")
    EXPERTISE_AREAS=("message-bus" "event-coordination" "message-ordering" "delivery")
    FOCUS_FILES=("*message*" "*bus*" "*event*" "*delivery*")
    RISK_FACTORS=("message-loss" "ordering-issues" "event-race-conditions")
    TOOLS=("message-tracer" "event-debugger" "flow-validator")
    ;;
    
  *)
    echo "❌ Unknown agent type: $AGENT_TYPE"
    exit 1
    ;;
esac

echo "🎯 Expertise areas: ${EXPERTISE_AREAS[*]}"
echo "🔍 Focus files: ${FOCUS_FILES[*]}"
echo "⚠️ Risk factors: ${RISK_FACTORS[*]}"
echo "🛠️ Recommended tools: ${TOOLS[*]}"
```

### 2. Smart Context Discovery
```bash
echo "🧠 Discovering optimal context for $AGENT_TYPE..."

# Use smart context discovery with agent specialization
claude --command .claude/commands/smart-context.md "$TASK_DESCRIPTION" "$AGENT_TYPE"

# Additional agent-specific context loading
echo "📁 Loading agent-specific context..."

# Find and prioritize files based on agent expertise
RELEVANT_FILES=()
for pattern in "${FOCUS_FILES[@]}"; do
  FILES=($(find . -name "$pattern" -type f 2>/dev/null | head -5))
  RELEVANT_FILES+=("${FILES[@]}")
done

# Remove duplicates and prioritize
UNIQUE_FILES=($(printf '%s\n' "${RELEVANT_FILES[@]}" | sort -u))

echo "📋 Found ${#UNIQUE_FILES[@]} relevant files for $AGENT_TYPE"

# Read most relevant files for this agent
for file in "${UNIQUE_FILES[@]:0:8}"; do
  if [[ -f "$file" ]]; then
    echo "📖 Loading agent-relevant file: $file"
    READ @"$file"
  fi
done
```

### 3. Agent-Specific Pattern Recognition
```bash
echo "📐 Identifying patterns relevant to $AGENT_TYPE..."

PATTERNS_DIR=".claude/intelligence/patterns"
mkdir -p "$PATTERNS_DIR"

AGENT_PATTERNS_FILE="$PATTERNS_DIR/$AGENT_TYPE-patterns.md"

# Create agent-specific pattern analysis
cat > "$AGENT_PATTERNS_FILE" << EOF
# $AGENT_TYPE Patterns Analysis
*Generated on $(date)*

## Relevant Patterns for Current Task
EOF

# Analyze files for agent-specific patterns
for file in "${UNIQUE_FILES[@]:0:5}"; do
  if [[ -f "$file" ]]; then
    echo "Analyzing patterns in: $file"
    
    # Look for patterns specific to this agent type
    case "$AGENT_TYPE" in
      "crypto-specialist")
        if grep -q "encrypt\|decrypt\|key\|crypto" "$file" 2>/dev/null; then
          echo "### Crypto Pattern in $file" >> "$AGENT_PATTERNS_FILE"
          echo "\`\`\`typescript" >> "$AGENT_PATTERNS_FILE"
          grep -A 3 -B 1 "encrypt\|decrypt\|key" "$file" | head -10 >> "$AGENT_PATTERNS_FILE"
          echo "\`\`\`" >> "$AGENT_PATTERNS_FILE"
          echo "" >> "$AGENT_PATTERNS_FILE"
        fi
        ;;
        
      "ui-specialist")
        if grep -q "React\|component\|useState\|useEffect" "$file" 2>/dev/null; then
          echo "### React Pattern in $file" >> "$AGENT_PATTERNS_FILE"
          echo "\`\`\`typescript" >> "$AGENT_PATTERNS_FILE"
          grep -A 3 -B 1 "React\|component\|useState" "$file" | head -10 >> "$AGENT_PATTERNS_FILE"
          echo "\`\`\`" >> "$AGENT_PATTERNS_FILE"
          echo "" >> "$AGENT_PATTERNS_FILE"
        fi
        ;;
        
      "storage-specialist")
        if grep -q "indexedDB\|query\|store\|database" "$file" 2>/dev/null; then
          echo "### Storage Pattern in $file" >> "$AGENT_PATTERNS_FILE"
          echo "\`\`\`typescript" >> "$AGENT_PATTERNS_FILE"
          grep -A 3 -B 1 "indexedDB\|query\|store" "$file" | head -10 >> "$AGENT_PATTERNS_FILE"
          echo "\`\`\`" >> "$AGENT_PATTERNS_FILE"
          echo "" >> "$AGENT_PATTERNS_FILE"
        fi
        ;;
    esac
  fi
done

echo "📐 Agent-specific patterns saved: $AGENT_PATTERNS_FILE"
```

### 4. Performance and Risk Analysis
```bash
echo "📊 Analyzing performance and risk factors for $AGENT_TYPE..."

# Agent-specific performance considerations
echo "⚡ Performance considerations for $AGENT_TYPE:"

case "$AGENT_TYPE" in
  "crypto-specialist")
    echo "- Encryption/decryption operations are CPU-intensive"
    echo "- Key generation should use secure random sources"
    echo "- Avoid storing sensitive data in memory longer than necessary"
    echo "- Consider using Web Workers for heavy crypto operations"
    ;;
    
  "ui-specialist")
    echo "- Component re-renders can impact performance"
    echo "- Large lists should use virtualization"
    echo "- Images and media should be optimized"
    echo "- Bundle size impact should be minimized"
    ;;
    
  "storage-specialist")
    echo "- IndexedDB operations should be batched when possible"
    echo "- Queries should use proper indexes"
    echo "- Large datasets may require pagination"
    echo "- Migration strategies should be backwards compatible"
    ;;
    
  "network-specialist")
    echo "- Connection failures should be handled gracefully"
    echo "- Implement exponential backoff for retries"
    echo "- Consider offline scenarios and queue management"
    echo "- WebSocket connections should auto-reconnect"
    ;;
    
  "message-flow-specialist")
    echo "- Message ordering must be preserved"
    echo "- Event handling should be idempotent"
    echo "- Message delivery should be reliable"
    echo "- Bus performance affects entire system"
    ;;
esac

# Agent-specific risk factors
echo ""
echo "⚠️ Key risk factors for $AGENT_TYPE:"
for risk in "${RISK_FACTORS[@]}"; do
  echo "- $risk"
done
```

### 5. Tool and Resource Recommendations
```bash
echo "🛠️ Recommending tools and resources for $AGENT_TYPE..."

# Create tool recommendations based on task and agent type
TOOLS_REPORT=".claude/intelligence/tool-recommendations-$AGENT_TYPE.md"

cat > "$TOOLS_REPORT" << EOF
# Tool Recommendations for $AGENT_TYPE
*Generated on $(date)*

## Recommended Tools for Current Task

### Primary Tools
EOF

# Add agent-specific tool recommendations
for tool in "${TOOLS[@]}"; do
  echo "- **$tool**: Essential for $AGENT_TYPE operations" >> "$TOOLS_REPORT"
done

cat >> "$TOOLS_REPORT" << EOF

### Validation Tools
EOF

case "$AGENT_TYPE" in
  "crypto-specialist")
    echo "- **encryption-tester**: Validate encryption/decryption cycles" >> "$TOOLS_REPORT"
    echo "- **key-validator**: Ensure proper key generation and storage" >> "$TOOLS_REPORT"
    echo "- **security-scanner**: Scan for crypto vulnerabilities" >> "$TOOLS_REPORT"
    ;;
    
  "ui-specialist")
    echo "- **lighthouse-audit**: Performance and accessibility testing" >> "$TOOLS_REPORT"
    echo "- **a11y-validator**: Accessibility compliance checking" >> "$TOOLS_REPORT"
    echo "- **responsive-tester**: Multi-device layout testing" >> "$TOOLS_REPORT"
    ;;
    
  "storage-specialist")
    echo "- **data-integrity-checker**: Validate data consistency" >> "$TOOLS_REPORT"
    echo "- **query-validator**: Optimize and validate queries" >> "$TOOLS_REPORT"
    echo "- **migration-tester**: Test migration safety" >> "$TOOLS_REPORT"
    ;;
esac

cat >> "$TOOLS_REPORT" << EOF

### Testing Commands
- \`npm test\` - Run unit tests
- \`npm run lint\` - Code quality validation
- \`npm run typecheck\` - TypeScript validation

### Performance Monitoring
- Monitor bundle size impact
- Check for memory leaks
- Validate performance metrics

EOF

echo "🛠️ Tool recommendations saved: $TOOLS_REPORT"
```

### 6. Generate Agent-Optimized Workflow
```bash
echo "⚙️ Generating optimized workflow for $AGENT_TYPE..."

WORKFLOW_FILE=".claude/intelligence/workflows/$AGENT_TYPE-workflow.md"
mkdir -p "$(dirname "$WORKFLOW_FILE")"

cat > "$WORKFLOW_FILE" << EOF
# Optimized Workflow for $AGENT_TYPE
*Task: $TASK_DESCRIPTION*
*Generated on $(date)*

## Pre-Implementation Checklist

### Context Verification
- [ ] Loaded relevant files: ${#UNIQUE_FILES[@]} files
- [ ] Identified patterns: Agent-specific patterns analyzed
- [ ] Risk assessment: ${#RISK_FACTORS[@]} risk factors identified
- [ ] Tools prepared: ${#TOOLS[@]} recommended tools available

### Agent-Specific Preparation
EOF

case "$AGENT_TYPE" in
  "crypto-specialist")
    cat >> "$WORKFLOW_FILE" << EOF
- [ ] Security requirements understood
- [ ] Encryption standards verified
- [ ] Key management strategy defined
- [ ] Sensitive data handling reviewed
EOF
    ;;
    
  "ui-specialist")
    cat >> "$WORKFLOW_FILE" << EOF
- [ ] Design system guidelines reviewed
- [ ] Accessibility requirements understood
- [ ] Performance budget defined
- [ ] Mobile compatibility verified
EOF
    ;;
    
  "storage-specialist")
    cat >> "$WORKFLOW_FILE" << EOF
- [ ] Data model reviewed
- [ ] Query optimization strategy planned
- [ ] Migration path defined
- [ ] Backup strategy verified
EOF
    ;;
esac

cat >> "$WORKFLOW_FILE" << EOF

## Implementation Steps

### 1. Initial Analysis
- Analyze existing implementation
- Identify integration points
- Assess complexity and effort

### 2. Design Phase
- Define approach specific to $AGENT_TYPE expertise
- Consider performance implications
- Plan error handling and validation

### 3. Implementation
- Follow agent-specific best practices
- Use recommended tools and patterns
- Implement with domain expertise

### 4. Validation
- Test thoroughly using agent-specific tools
- Validate against risk factors
- Ensure quality standards met

### 5. Integration
- Ensure proper integration with SolConnect architecture
- Test cross-component interactions
- Validate end-to-end functionality

## Success Criteria
- Implementation meets $AGENT_TYPE quality standards
- All risk factors addressed
- Performance requirements satisfied
- Integration with SolConnect architecture verified

EOF

echo "⚙️ Optimized workflow saved: $WORKFLOW_FILE"
```

### 7. Provide Intelligent Guidance
```bash
echo "🎯 Providing intelligent guidance for $AGENT_TYPE..."

echo ""
echo "🎯 INTELLIGENT GUIDANCE FOR $AGENT_TYPE"
echo "=================================="
echo ""

echo "🏗️ RECOMMENDED APPROACH:"
case "$AGENT_TYPE" in
  "crypto-specialist")
    echo "1. Start with security analysis of existing implementation"
    echo "2. Identify encryption/decryption requirements"
    echo "3. Implement with secure coding practices"
    echo "4. Validate with security testing tools"
    echo "5. Ensure no sensitive data exposure"
    ;;
    
  "ui-specialist")
    echo "1. Analyze existing component structure"
    echo "2. Plan responsive and accessible design"
    echo "3. Implement with performance optimization"
    echo "4. Test across devices and browsers"
    echo "5. Validate accessibility compliance"
    ;;
    
  "storage-specialist")
    echo "1. Analyze current data model and queries"
    echo "2. Plan efficient storage strategy"
    echo "3. Implement with transaction safety"
    echo "4. Test data integrity and performance"
    echo "5. Ensure migration compatibility"
    ;;
    
  "network-specialist")
    echo "1. Analyze current network architecture"
    echo "2. Plan resilient connection handling"
    echo "3. Implement with offline considerations"
    echo "4. Test connection failure scenarios"
    echo "5. Validate real-time performance"
    ;;
    
  "message-flow-specialist")
    echo "1. Map current message flow and events"
    echo "2. Plan reliable delivery strategy"
    echo "3. Implement with ordering guarantees"
    echo "4. Test message coordination"
    echo "5. Validate end-to-end flow"
    ;;
esac

echo ""
echo "⚠️ KEY RISK MITIGATION:"
for i in "${!RISK_FACTORS[@]}"; do
  echo "$((i+1)). Monitor and prevent: ${RISK_FACTORS[$i]}"
done

echo ""
echo "🛠️ ESSENTIAL TOOLS TO USE:"
for i in "${!TOOLS[@]}"; do
  echo "$((i+1)). ${TOOLS[$i]}"
done

echo ""
echo "📊 PERFORMANCE TARGETS:"
echo "- Implementation time: Optimal for $AGENT_TYPE expertise"
echo "- Quality score: >90% based on agent-specific criteria"
echo "- Risk mitigation: Address all ${#RISK_FACTORS[@]} identified risk factors"
echo "- Integration success: Seamless with SolConnect architecture"

echo ""
echo "✨ You are now optimally prepared for this task as a $AGENT_TYPE!"
echo "🚀 Begin implementation with confidence using the provided context and guidance."
```

## Usage Examples

### For Crypto Specialist
```bash
claude --command .claude/commands/amplify-agent.md "crypto-specialist" "Add message encryption to the chat feature"
```

### For UI Specialist  
```bash
claude --command .claude/commands/amplify-agent.md "ui-specialist" "Create a responsive message reaction picker component"
```

### For Storage Specialist
```bash
claude --command .claude/commands/amplify-agent.md "storage-specialist" "Implement efficient message search indexing"
```