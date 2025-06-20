# SolConnect Feature Complexity Router

## Complexity Assessment & Agent Routing

### Simple Features (Single Agent)
**Characteristics**: Isolated changes, minimal integration points, clear requirements
**Examples**: UI styling updates, simple component additions, configuration changes

```bash
# Route to appropriate specialist agent
if [[ "$FEATURE_TYPE" == "ui-styling" ]]; then
  claude --agent ui-specialist --context .claude/commands/messaging-agent-patterns.md
elif [[ "$FEATURE_TYPE" == "crypto-fix" ]]; then
  claude --agent crypto-specialist --context .claude/commands/messaging-agent-patterns.md
fi
```

### Medium Features (2-3 Coordinated Agents)
**Characteristics**: Cross-component integration, moderate complexity, defined interfaces
**Examples**: Message reactions, status indicators, user preferences

```bash
# Multi-agent coordination with primary lead
PRIMARY_AGENT="ui-specialist"
SUPPORTING_AGENTS=("storage-specialist" "message-flow-specialist")

# Initialize coordinated development
claude --multi-agent \
  --primary "$PRIMARY_AGENT" \
  --supporting "${SUPPORTING_AGENTS[@]}" \
  --spec "specs/spec_message_reactions.md"
```

### Complex Features (4+ Agents + Parallel Development)
**Characteristics**: System-wide changes, performance implications, architectural decisions
**Examples**: End-to-end encryption updates, offline sync overhaul, multi-device support

```bash
# Full parallel development with specialized agent teams
claude --command .claude/commands/init-parallel.md "e2e-encryption-v2" "3"

# Team A: Security-first approach
TEAM_A_AGENTS=("crypto-specialist" "storage-specialist")

# Team B: Performance-first approach  
TEAM_B_AGENTS=("message-flow-specialist" "network-specialist")

# Team C: UX-first approach
TEAM_C_AGENTS=("ui-specialist" "message-flow-specialist")
```

## Feature Complexity Decision Tree

```
Feature Request
│
├─ Affects single component/service?
│  ├─ YES → Single Agent Pattern
│  │   ├─ UI changes only → UI Agent
│  │   ├─ Crypto/security → Crypto Agent  
│  │   ├─ Storage/data → Storage Agent
│  │   ├─ Network/relay → Network Agent
│  │   └─ Message flow → Message Flow Agent
│  │
│  └─ NO → Multi-Agent Assessment
│      │
│      ├─ <3 integration points → Coordinated Agents (2-3)
│      │   └─ Assign primary + supporting agents
│      │
│      └─ ≥3 integration points → Complex Feature
│          │
│          ├─ Clear requirements → Parallel Development
│          │   └─ 3+ agent teams with different approaches
│          │
│          └─ Unclear requirements → Research Phase
│              └─ Single research agent → spec creation → parallel development
```

## Agent Selection Criteria

### Primary Agent Selection
```javascript
function selectPrimaryAgent(feature) {
  const impacts = analyzeFeatureImpacts(feature);
  
  if (impacts.ui > 0.7) return "ui-specialist";
  if (impacts.crypto > 0.7) return "crypto-specialist";
  if (impacts.storage > 0.7) return "storage-specialist";
  if (impacts.network > 0.7) return "network-specialist";
  
  // Default to message flow for complex integrations
  return "message-flow-specialist";
}
```

### Supporting Agent Requirements
```javascript
function selectSupportingAgents(feature, primaryAgent) {
  const requiredDomains = [];
  
  if (feature.requiresEncryption && primaryAgent !== "crypto-specialist") {
    requiredDomains.push("crypto-specialist");
  }
  
  if (feature.requiresStorage && primaryAgent !== "storage-specialist") {
    requiredDomains.push("storage-specialist");
  }
  
  if (feature.requiresUI && primaryAgent !== "ui-specialist") {
    requiredDomains.push("ui-specialist");
  }
  
  if (feature.requiresNetworking && primaryAgent !== "network-specialist") {
    requiredDomains.push("network-specialist");
  }
  
  return requiredDomains;
}
```

## Execution Templates

### Single Agent Execution
```bash
#!/bin/bash
FEATURE_SPEC="$1"
AGENT_TYPE="$2"

# Prime agent with SolConnect context
claude --context .claude/commands/solconnect-context.md

# Load agent-specific patterns
claude --context ".claude/commands/messaging-agent-patterns.md#${AGENT_TYPE}"

# Execute feature implementation
claude --spec "$FEATURE_SPEC"

# Validate implementation
claude --command .claude/commands/validate-implementation.md
```

### Coordinated Multi-Agent Execution
```bash
#!/bin/bash
FEATURE_SPEC="$1"
PRIMARY_AGENT="$2"
shift 2
SUPPORTING_AGENTS=("$@")

echo "🚀 Starting coordinated development with $PRIMARY_AGENT leading"

# Initialize shared context
claude --context .claude/commands/solconnect-context.md

# Primary agent begins implementation
claude --agent "$PRIMARY_AGENT" --spec "$FEATURE_SPEC" --mode primary

# Supporting agents contribute in parallel
for agent in "${SUPPORTING_AGENTS[@]}"; do
  claude --agent "$agent" --spec "$FEATURE_SPEC" --mode supporting &
done

wait # Wait for all supporting agents

# Integration and validation
claude --mode integration --agents "$PRIMARY_AGENT" "${SUPPORTING_AGENTS[@]}"
claude --command .claude/commands/validate-implementation.md
```

### Parallel Development Execution
```bash
#!/bin/bash
FEATURE_SPEC="$1"
PARALLEL_COUNT="$2"

echo "🔄 Starting parallel development with $PARALLEL_COUNT teams"

# Initialize parallel workspaces
claude --command .claude/commands/init-parallel.md "$FEATURE_NAME" "$PARALLEL_COUNT"

# Execute parallel implementations
for i in $(seq 1 "$PARALLEL_COUNT"); do
  (
    cd "dev-trees/${FEATURE_NAME}-v${i}"
    
    # Different agent team for each workspace
    case $i in
      1) TEAM=("crypto-specialist" "storage-specialist") ;;
      2) TEAM=("ui-specialist" "message-flow-specialist") ;;
      3) TEAM=("network-specialist" "message-flow-specialist") ;;
      *) TEAM=("message-flow-specialist") ;;
    esac
    
    claude --multi-agent --team "${TEAM[@]}" --spec "../../../$FEATURE_SPEC"
    claude --command .claude/commands/validate-implementation.md > RESULTS.md
  ) &
done

wait # Wait for all parallel implementations

# Evaluate and select best implementation
claude --mode evaluation --compare dev-trees/*/RESULTS.md
```

## Performance Optimization Routing

### High-Performance Features
```bash
# Route performance-critical features to specialized optimization agents
if [[ "$FEATURE_TAGS" == *"performance-critical"* ]]; then
  OPTIMIZATION_AGENTS=("performance-specialist" "memory-specialist")
  claude --agents "${OPTIMIZATION_AGENTS[@]}" --context performance-constraints.md
fi
```

### Memory-Sensitive Features  
```bash
# Route memory-sensitive features with specific constraints
if [[ "$MEMORY_CONSTRAINT" == "mobile" ]]; then
  MOBILE_AGENTS=("mobile-performance-specialist" "ui-specialist")
  claude --agents "${MOBILE_AGENTS[@]}" --constraint "max-bundle-increase:50kb"
fi
```

This routing system ensures optimal agent assignment based on feature complexity while maintaining SolConnect's architectural integrity and performance requirements.