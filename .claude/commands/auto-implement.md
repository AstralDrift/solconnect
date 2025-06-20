# Auto-Implementation Router for SolConnect Features

## Input
SPEC_FILE: $ARGUMENTS

## Process

### 1. Load and Analyze Specification
READ: SPEC_FILE

### 2. Determine Implementation Strategy
```
Analyze the specification and determine:

1. Feature Complexity Assessment:
   - Count affected components (SolConnectSDK, MessageBus, UI, Storage, Crypto, Network)
   - Estimate integration complexity
   - Identify performance/security requirements
   
2. Classify as:
   - SIMPLE: Single agent implementation
   - MEDIUM: Coordinated multi-agent (2-3 agents)
   - COMPLEX: Parallel development (3+ agent teams)

3. Agent Assignment:
   - Primary domain: [crypto|ui|storage|network|message-flow]
   - Supporting domains: [list of additional domains needed]
   - Special requirements: [performance|security|mobile|accessibility]
```

### 3. Route to Appropriate Implementation Pattern

#### For SIMPLE Features:
```bash
# Single specialist agent
AGENT_TYPE=$(determine_primary_domain SPEC_FILE)
claude --agent "$AGENT_TYPE" --context .claude/commands/messaging-agent-patterns.md --spec "$SPEC_FILE"
```

#### For MEDIUM Features:
```bash
# Coordinated multi-agent implementation
PRIMARY_AGENT=$(determine_primary_domain SPEC_FILE)
SUPPORTING_AGENTS=$(determine_supporting_domains SPEC_FILE)

echo "🚀 Starting coordinated implementation"
echo "Primary: $PRIMARY_AGENT"
echo "Supporting: ${SUPPORTING_AGENTS[@]}"

# Execute coordinated development
claude --multi-agent \
  --primary "$PRIMARY_AGENT" \
  --supporting "${SUPPORTING_AGENTS[@]}" \
  --spec "$SPEC_FILE" \
  --context .claude/commands/messaging-agent-patterns.md
```

#### For COMPLEX Features:
```bash
# Parallel development with multiple teams
FEATURE_NAME=$(extract_feature_name SPEC_FILE)
PARALLEL_COUNT=3

echo "🔄 Starting parallel development for complex feature"
echo "Feature: $FEATURE_NAME"
echo "Parallel teams: $PARALLEL_COUNT"

# Initialize parallel workspaces
claude --command .claude/commands/init-parallel.md "$FEATURE_NAME" "$PARALLEL_COUNT"

# Execute parallel implementations with different focuses
claude --command .claude/commands/exe-parallel.md "$SPEC_FILE" "$PARALLEL_COUNT"

# Evaluate and create hybrid implementation
claude --command .claude/commands/evaluate-parallel.md "$FEATURE_NAME"
```

### 4. Progress Tracking and Reporting
```
Implementation Status:
- Strategy: [SIMPLE|MEDIUM|COMPLEX]
- Agents assigned: [list]
- Estimated completion: [time]
- Progress: [percentage]

Monitor implementation and provide real-time updates.
```

### 5. Automatic Validation
```bash
# Run comprehensive validation after implementation
claude --command .claude/commands/validate-implementation.md

# Report results
echo "✅ Implementation completed successfully"
echo "📊 Test results: [pass/fail counts]"
echo "🔍 Code quality: [lint/typecheck results]" 
echo "⚡ Performance: [benchmark results]"
```

## Agent Domain Detection Logic

```javascript
function determine_primary_domain(spec_content) {
  const domain_indicators = {
    'crypto': ['encryption', 'decrypt', 'key', 'signature', 'wallet', 'solana'],
    'ui': ['component', 'react', 'interface', 'button', 'modal', 'responsive'],
    'storage': ['database', 'indexeddb', 'persist', 'cache', 'query'],
    'network': ['websocket', 'relay', 'connection', 'sync', 'offline'],
    'message-flow': ['message', 'send', 'receive', 'deliver', 'bus', 'event']
  };
  
  // Count domain indicators in spec
  const scores = {};
  for (const [domain, indicators] of Object.entries(domain_indicators)) {
    scores[domain] = indicators.filter(indicator => 
      spec_content.toLowerCase().includes(indicator)
    ).length;
  }
  
  // Return domain with highest score
  return Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
}
```

## Implementation Time Estimates

| Complexity | Agent Count | Typical Duration | Examples |
|------------|-------------|------------------|----------|
| SIMPLE | 1 | 10-30 minutes | Styling updates, simple UI components |
| MEDIUM | 2-3 | 30-90 minutes | Message reactions, status indicators |
| COMPLEX | 3+ teams | 2-4 hours | Search functionality, voice messages |