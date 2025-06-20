# SolConnect Feature Complexity Auto-Detection

## Input
FEATURE_DESCRIPTION: $ARGUMENTS

## Complexity Detection Algorithm

### 1. Parse Feature Description
```javascript
function parseFeatureDescription(description) {
  const tokens = description.toLowerCase().split(/\s+/);
  const keywords = {
    components: [],
    domains: [],
    complexity_indicators: [],
    performance_requirements: [],
    integration_points: []
  };
  
  // Extract relevant keywords and classify
  return analyzeTokens(tokens, keywords);
}
```

### 2. SolConnect Component Impact Analysis
```javascript
const SOLCONNECT_COMPONENTS = {
  'ui': {
    keywords: ['component', 'react', 'interface', 'button', 'modal', 'form', 'styling', 'theme', 'responsive'],
    weight: 1.0,
    files: ['src/components/', 'src/screens/', 'src/styles/']
  },
  'crypto': {
    keywords: ['encrypt', 'decrypt', 'key', 'signature', 'wallet', 'solana', 'security', 'private'],
    weight: 2.0, // Higher weight due to security implications
    files: ['src/services/crypto/', 'core/solchat_protocol/src/crypto/']
  },
  'storage': {
    keywords: ['database', 'indexeddb', 'persist', 'cache', 'query', 'store', 'save'],
    weight: 1.5,
    files: ['src/services/storage/', 'src/services/sync/']
  },
  'network': {
    keywords: ['websocket', 'relay', 'connection', 'sync', 'offline', 'real-time'],
    weight: 1.5,
    files: ['src/services/transport/', 'src/services/network/', 'relay.js']
  },
  'message_flow': {
    keywords: ['message', 'send', 'receive', 'deliver', 'bus', 'event', 'chat'],
    weight: 1.2,
    files: ['src/services/SolConnectSDK.ts', 'src/services/MessageBus.ts']
  },
  'solana': {
    keywords: ['blockchain', 'transaction', 'wallet', 'signature', 'solana', 'web3'],
    weight: 1.8, // Blockchain integration is complex
    files: ['src/services/wallet/', 'src/services/solana/']
  }
};

function calculateComponentImpact(description) {
  const impacts = {};
  const words = description.toLowerCase();
  
  for (const [component, config] of Object.entries(SOLCONNECT_COMPONENTS)) {
    let score = 0;
    config.keywords.forEach(keyword => {
      if (words.includes(keyword)) {
        score += config.weight;
      }
    });
    impacts[component] = score;
  }
  
  return impacts;
}
```

### 3. Complexity Scoring Matrix
```javascript
function calculateComplexityScore(description, impacts) {
  let score = 0;
  
  // Base complexity from component impacts
  const affectedComponents = Object.values(impacts).filter(impact => impact > 0).length;
  score += affectedComponents * 10;
  
  // Weighted component complexity
  score += Object.values(impacts).reduce((sum, impact) => sum + impact, 0);
  
  // Additional complexity indicators
  const complexityIndicators = {
    'real-time': 15,        // Real-time features are complex
    'encryption': 20,       // Encryption changes are high-risk
    'offline': 18,          // Offline sync is complex
    'performance': 12,      // Performance optimization needed
    'cross-platform': 10,   // Web + mobile compatibility
    'voice': 25,           // Voice/audio features are complex
    'video': 30,           // Video features are very complex
    'file': 15,            // File handling complexity
    'search': 20,          // Search with encryption is complex
    'sync': 18,            // Multi-device sync complexity
    'notification': 15,     // Push notifications complexity
    'group': 12,           // Group chat features
    'media': 18,           // Media handling complexity
    'backup': 22,          // Backup/restore complexity
    'migration': 25        // Data migration complexity
  };
  
  const words = description.toLowerCase();
  for (const [indicator, points] of Object.entries(complexityIndicators)) {
    if (words.includes(indicator)) {
      score += points;
    }
  }
  
  return score;
}
```

### 4. Classification Rules
```javascript
function classifyComplexity(score, impacts, description) {
  const affectedComponents = Object.values(impacts).filter(impact => impact > 0).length;
  
  // Rule-based classification with score and heuristics
  if (score <= 25 && affectedComponents <= 2) {
    return {
      level: 'SIMPLE',
      strategy: 'single-agent',
      estimatedTime: '10-30 minutes',
      agents: [determinePrimaryAgent(impacts)]
    };
  } else if (score <= 60 && affectedComponents <= 4) {
    return {
      level: 'MEDIUM', 
      strategy: 'coordinated-agents',
      estimatedTime: '30-90 minutes',
      agents: [determinePrimaryAgent(impacts), ...determineSupportingAgents(impacts)]
    };
  } else {
    return {
      level: 'COMPLEX',
      strategy: 'parallel-development',
      estimatedTime: '2-4 hours',
      agents: ['Team 1: Security-first', 'Team 2: Performance-first', 'Team 3: UX-first']
    };
  }
}
```

### 5. Agent Assignment Logic
```javascript
function determinePrimaryAgent(impacts) {
  const sortedImpacts = Object.entries(impacts)
    .sort(([,a], [,b]) => b - a)
    .filter(([,impact]) => impact > 0);
    
  if (sortedImpacts.length === 0) return 'message-flow-specialist';
  
  const agentMapping = {
    'ui': 'ui-specialist',
    'crypto': 'crypto-specialist',
    'storage': 'storage-specialist', 
    'network': 'network-specialist',
    'message_flow': 'message-flow-specialist',
    'solana': 'crypto-specialist' // Solana work often involves crypto
  };
  
  return agentMapping[sortedImpacts[0][0]] || 'message-flow-specialist';
}

function determineSupportingAgents(impacts) {
  const agents = [];
  const primary = determinePrimaryAgent(impacts);
  
  // Add supporting agents for significant impacts
  for (const [component, impact] of Object.entries(impacts)) {
    if (impact > 0.5 && component !== primary.replace('-specialist', '')) {
      const agentMapping = {
        'ui': 'ui-specialist',
        'crypto': 'crypto-specialist', 
        'storage': 'storage-specialist',
        'network': 'network-specialist',
        'message_flow': 'message-flow-specialist'
      };
      
      const agent = agentMapping[component];
      if (agent && !agents.includes(agent)) {
        agents.push(agent);
      }
    }
  }
  
  return agents;
}
```

## 6. Output Analysis Report
```
Feature Analysis: FEATURE_DESCRIPTION

Component Impact Analysis:
- UI Impact: ${impacts.ui}/5.0
- Crypto Impact: ${impacts.crypto}/5.0  
- Storage Impact: ${impacts.storage}/5.0
- Network Impact: ${impacts.network}/5.0
- Message Flow Impact: ${impacts.message_flow}/5.0
- Solana Impact: ${impacts.solana}/5.0

Complexity Score: ${score}/100
Classification: ${classification.level}
Implementation Strategy: ${classification.strategy}
Estimated Time: ${classification.estimatedTime}

Recommended Agents:
${classification.agents.join('\n')}

Detected Requirements:
- Performance sensitive: ${hasPerformanceRequirements}
- Security critical: ${hasSecurityRequirements}  
- Mobile compatibility: ${hasMobileRequirements}
- Real-time features: ${hasRealTimeRequirements}
- Offline support: ${hasOfflineRequirements}

Next Steps:
1. Generate detailed specification
2. ${classification.strategy === 'parallel-development' ? 'Initialize parallel workspaces' : 'Assign to ' + classification.agents[0]}
3. Begin implementation
```

## 7. Integration with Auto-Implementation
```bash
# Use complexity detection to route implementation
COMPLEXITY_RESULT=$(claude --command .claude/commands/detect-complexity.md "$FEATURE_DESCRIPTION")
STRATEGY=$(echo "$COMPLEXITY_RESULT" | grep "Implementation Strategy:" | cut -d: -f2)

case "$STRATEGY" in
  "single-agent")
    claude --command .claude/commands/single-agent-implement.md ;;
  "coordinated-agents") 
    claude --command .claude/commands/coordinated-implement.md ;;
  "parallel-development")
    claude --command .claude/commands/parallel-implement.md ;;
esac
```