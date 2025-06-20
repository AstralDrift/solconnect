# Intelligent Context Discovery Engine

## Auto-Context Generation for Any File/Function

### Universal Context Command
```bash
# Generate perfect context for any development task
claude --context-for "src/services/SolConnectSDK.ts:sendMessage"
claude --context-for "message reactions feature"
claude --context-for "encryption bug in crypto service"
```

### Dynamic Context Discovery
```javascript
// Context Engine Algorithm
class ContextEngine {
  async generateContext(target, agentType = null) {
    const context = {
      immediate: await this.getImmediateContext(target),
      dependencies: await this.getDependencyChain(target),
      relatedComponents: await this.findRelatedComponents(target),
      patterns: await this.getRelevantPatterns(target),
      history: await this.getChangeHistory(target),
      testCoverage: await this.getTestContext(target),
      agentSpecific: agentType ? await this.getAgentContext(target, agentType) : null
    };
    
    return this.prioritizeAndFormat(context);
  }
  
  async getImmediateContext(target) {
    // File-level context
    if (target.includes('.ts') || target.includes('.tsx')) {
      return {
        imports: await this.extractImports(target),
        exports: await this.extractExports(target),
        interfaces: await this.extractInterfaces(target),
        functions: await this.extractFunctions(target)
      };
    }
    
    // Feature-level context
    if (target.includes('feature') || target.includes('implement')) {
      return await this.getFeatureContext(target);
    }
    
    // Bug-level context
    if (target.includes('bug') || target.includes('fix') || target.includes('error')) {
      return await this.getBugContext(target);
    }
  }
}
```

### Agent-Specific Context Adaptation
```typescript
interface AgentContext {
  cryptoSpecialist: {
    focus: ['encryption', 'keys', 'security', 'wallets', 'signatures'],
    relevantFiles: string[],
    securityConsiderations: string[],
    cryptoPatterns: Pattern[]
  };
  
  uiSpecialist: {
    focus: ['components', 'styling', 'accessibility', 'responsive', 'animations'],
    relevantFiles: string[],
    designPatterns: Pattern[],
    performanceConsiderations: string[]
  };
  
  storageSpecialist: {
    focus: ['indexeddb', 'persistence', 'queries', 'migrations', 'caching'],
    relevantFiles: string[],
    dataPatterns: Pattern[],
    performanceMetrics: Metric[]
  };
}

class AgentContextAdapter {
  async adaptContextForAgent(baseContext: Context, agentType: AgentType): Promise<AgentContext> {
    const adapter = this.getAgentAdapter(agentType);
    return {
      ...baseContext,
      prioritizedFiles: adapter.prioritizeFiles(baseContext.relatedFiles),
      focusAreas: adapter.identifyFocusAreas(baseContext),
      recommendations: adapter.generateRecommendations(baseContext),
      warnings: adapter.identifyRisks(baseContext)
    };
  }
}
```

### Smart File Discovery
```bash
# Auto-discover relevant files for any task
function discover_relevant_files() {
  local task="$1"
  local agent_type="$2"
  
  # Extract keywords from task description
  keywords=$(echo "$task" | tr ' ' '\n' | grep -E '^[a-zA-Z]{3,}$')
  
  # Search codebase intelligently
  relevant_files=()
  
  for keyword in $keywords; do
    # Search in file names
    relevant_files+=($(find . -name "*${keyword}*" -type f))
    
    # Search in file contents
    relevant_files+=($(rg -l "$keyword" --type ts --type tsx --type js))
    
    # Search in comments and documentation
    relevant_files+=($(rg -l "(?i)$keyword" --type md))
  done
  
  # Remove duplicates and rank by relevance
  echo "${relevant_files[@]}" | tr ' ' '\n' | sort | uniq | head -10
}
```

### Relationship Mapping
```typescript
class ComponentRelationshipMapper {
  async mapRelationships(targetFile: string): Promise<RelationshipMap> {
    const relationships = {
      imports: await this.getDirectImports(targetFile),
      exports: await this.getDirectExports(targetFile),
      usedBy: await this.findUsages(targetFile),
      dependencies: await this.getDependencyChain(targetFile),
      testFiles: await this.findRelatedTests(targetFile),
      documentation: await this.findRelatedDocs(targetFile)
    };
    
    return this.buildRelationshipGraph(relationships);
  }
  
  async getDirectImports(file: string): Promise<Import[]> {
    const content = await fs.readFile(file, 'utf-8');
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = this.resolveImportPath(match[1], file);
      imports.push({
        path: importPath,
        type: this.determineImportType(importPath),
        usage: this.analyzeUsage(content, match[0])
      });
    }
    
    return imports;
  }
}
```

### Live Architecture Visualization
```mermaid
# Auto-generated from codebase analysis
graph TD
    SDK[SolConnectSDK] --> MessageBus[MessageBus]
    SDK --> CryptoService[CryptoService]
    MessageBus --> MessageTransport[MessageTransport]
    MessageBus --> MessageStorage[MessageStorage]
    MessageTransport --> WebSocketRelay[WebSocket Relay]
    CryptoService --> WalletService[WalletService]
    
    # Dynamic updates based on recent changes
    MessageBus -.-> NotificationService[NotificationService]
    SDK -.-> SearchService[SearchService]
```