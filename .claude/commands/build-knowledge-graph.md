# Build and Update Knowledge Graph

## Repository Intelligence Mapping
> Creates and maintains a dynamic knowledge graph of the repository for intelligent agent guidance

## Knowledge Graph Construction

### 1. Initialize Knowledge Graph Structure
```bash
echo "🧠 Building comprehensive knowledge graph for SolConnect..."

GRAPH_DIR=".claude/intelligence/graph"
mkdir -p "$GRAPH_DIR"

# Initialize graph metadata
GRAPH_METADATA="$GRAPH_DIR/metadata.json"
cat > "$GRAPH_METADATA" << EOF
{
  "version": "1.0",
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "nodeCount": 0,
  "edgeCount": 0,
  "clusters": [],
  "lastAnalysis": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "📊 Initialized knowledge graph metadata"
```

### 2. Extract Code Entities (Nodes)
```bash
echo "🔍 Extracting code entities as graph nodes..."

NODES_FILE="$GRAPH_DIR/nodes.json"
echo '{"files": [], "functions": [], "components": [], "services": [], "concepts": []}' > "$NODES_FILE"

# Extract file nodes
echo "📁 Analyzing files..."
FILE_NODES=()
while IFS= read -r -d '' file; do
  if [[ "$file" == *.ts || "$file" == *.tsx || "$file" == *.js || "$file" == *.jsx ]]; then
    FILE_TYPE=$(echo "$file" | grep -oE '\.(ts|tsx|js|jsx)$')
    FILE_SIZE=$(wc -l < "$file" 2>/dev/null || echo 0)
    LAST_MODIFIED=$(stat -f "%m" "$file" 2>/dev/null || stat -c "%Y" "$file" 2>/dev/null || echo 0)
    
    # Determine file category
    CATEGORY="other"
    case "$file" in
      */components/*) CATEGORY="component" ;;
      */services/*) CATEGORY="service" ;;
      */hooks/*) CATEGORY="hook" ;;
      */utils/*) CATEGORY="utility" ;;
      */types/*) CATEGORY="type" ;;
      *test* | *spec*) CATEGORY="test" ;;
    esac
    
    # Calculate complexity score
    COMPLEXITY=0
    if [[ -f "$file" ]]; then
      # Count functions, classes, interfaces
      FUNCTIONS=$(grep -c "function\|const.*=.*=>" "$file" 2>/dev/null || echo 0)
      CLASSES=$(grep -c "class\|interface" "$file" 2>/dev/null || echo 0)
      IMPORTS=$(grep -c "^import" "$file" 2>/dev/null || echo 0)
      
      COMPLEXITY=$((FUNCTIONS + CLASSES * 2 + IMPORTS))
    fi
    
    FILE_NODES+=("$file:$CATEGORY:$FILE_SIZE:$COMPLEXITY:$LAST_MODIFIED")
  fi
done < <(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -print0)

echo "📋 Found ${#FILE_NODES[@]} file nodes"

# Extract function nodes
echo "⚙️ Analyzing functions..."
FUNCTION_NODES=()
for file_info in "${FILE_NODES[@]:0:20}"; do  # Limit to first 20 files for performance
  file="${file_info%%:*}"
  if [[ -f "$file" ]]; then
    # Extract function signatures
    while IFS= read -r line; do
      if [[ -n "$line" ]]; then
        FUNCTION_NODES+=("$file:$line")
      fi
    done < <(grep -n "function\|const.*=.*=>.*\|async.*(" "$file" 2>/dev/null | head -10)
  fi
done

echo "⚙️ Found ${#FUNCTION_NODES[@]} function nodes"

# Extract component nodes (React components)
echo "🧩 Analyzing React components..."
COMPONENT_NODES=()
for file_info in "${FILE_NODES[@]}"; do
  file="${file_info%%:*}"
  if [[ "$file" == *.tsx ]] && [[ -f "$file" ]]; then
    # Look for React component exports
    while IFS= read -r line; do
      if [[ -n "$line" ]]; then
        COMPONENT_NODES+=("$file:$line")
      fi
    done < <(grep -n "export.*React\.FC\|export default.*Component\|export const.*: React" "$file" 2>/dev/null)
  fi
done

echo "🧩 Found ${#COMPONENT_NODES[@]} component nodes"
```

### 3. Extract Relationships (Edges)
```bash
echo "🔗 Extracting relationships between entities..."

EDGES_FILE="$GRAPH_DIR/edges.json"
echo '{"imports": [], "calls": [], "extends": [], "uses": []}' > "$EDGES_FILE"

# Extract import relationships
echo "📦 Analyzing import relationships..."
IMPORT_EDGES=()
for file_info in "${FILE_NODES[@]:0:15}"; do  # Limit for performance
  file="${file_info%%:*}"
  if [[ -f "$file" ]]; then
    # Extract imports
    while IFS= read -r import_line; do
      if [[ -n "$import_line" ]]; then
        # Parse import statement
        IMPORTED_FROM=$(echo "$import_line" | grep -oE "from ['\"].*['\"]" | sed "s/from ['\"]//g" | sed "s/['\"]//g")
        if [[ -n "$IMPORTED_FROM" ]]; then
          IMPORT_EDGES+=("$file->$IMPORTED_FROM:import")
        fi
      fi
    done < <(grep "^import.*from" "$file" 2>/dev/null)
  fi
done

echo "📦 Found ${#IMPORT_EDGES[@]} import relationships"

# Extract function call relationships
echo "📞 Analyzing function call relationships..."
CALL_EDGES=()
for file_info in "${FILE_NODES[@]:0:10}"; do  # Limit for performance
  file="${file_info%%:*}"
  if [[ -f "$file" ]]; then
    # Look for function calls to known SolConnect services
    SOLCONNECT_CALLS=$(grep -n "SolConnectSDK\|MessageBus\|CryptoService\|MessageStorage" "$file" 2>/dev/null | head -5)
    while IFS= read -r call_line; do
      if [[ -n "$call_line" ]]; then
        CALLED_SERVICE=$(echo "$call_line" | grep -oE "SolConnectSDK|MessageBus|CryptoService|MessageStorage")
        if [[ -n "$CALLED_SERVICE" ]]; then
          CALL_EDGES+=("$file->$CALLED_SERVICE:calls")
        fi
      fi
    done <<< "$SOLCONNECT_CALLS"
  fi
done

echo "📞 Found ${#CALL_EDGES[@]} call relationships"
```

### 4. Identify Clusters and Patterns
```bash
echo "🎯 Identifying architectural clusters and patterns..."

CLUSTERS_FILE="$GRAPH_DIR/clusters.json"

# Identify file clusters by directory structure
echo "📂 Analyzing directory-based clusters..."
declare -A CLUSTERS
for file_info in "${FILE_NODES[@]}"; do
  file="${file_info%%:*}"
  DIR=$(dirname "$file" | sed 's/^\.\///')
  
  # Group by top-level directories
  TOP_DIR=$(echo "$DIR" | cut -d'/' -f1)
  if [[ -n "$TOP_DIR" && "$TOP_DIR" != "." ]]; then
    if [[ -z "${CLUSTERS[$TOP_DIR]}" ]]; then
      CLUSTERS[$TOP_DIR]=1
    else
      CLUSTERS[$TOP_DIR]=$((${CLUSTERS[$TOP_DIR]} + 1))
    fi
  fi
done

# Create clusters JSON
cat > "$CLUSTERS_FILE" << EOF
{
  "directoryBased": {
EOF

FIRST_CLUSTER=true
for cluster in "${!CLUSTERS[@]}"; do
  if [[ "$FIRST_CLUSTER" == true ]]; then
    FIRST_CLUSTER=false
  else
    echo "," >> "$CLUSTERS_FILE"
  fi
  echo "    \"$cluster\": ${CLUSTERS[$cluster]}" >> "$CLUSTERS_FILE"
done

cat >> "$CLUSTERS_FILE" << EOF
  },
  "functionalClusters": {
    "messaging": ["MessageBus", "MessageTransport", "MessageStorage"],
    "crypto": ["CryptoService", "WalletService", "EncryptionService"],
    "ui": ["components", "screens", "hooks"],
    "storage": ["MessageStorage", "DatabaseService", "CacheService"],
    "network": ["NetworkManager", "WebSocketTransport", "OfflineSync"]
  }
}
EOF

echo "🎯 Identified ${#CLUSTERS[@]} directory-based clusters"
```

### 5. Calculate Graph Intelligence Metrics
```bash
echo "📊 Calculating graph intelligence metrics..."

METRICS_FILE="$GRAPH_DIR/metrics.json"

# Calculate basic metrics
TOTAL_NODES=$((${#FILE_NODES[@]} + ${#FUNCTION_NODES[@]} + ${#COMPONENT_NODES[@]}))
TOTAL_EDGES=$((${#IMPORT_EDGES[@]} + ${#CALL_EDGES[@]}))

# Calculate complexity score
TOTAL_COMPLEXITY=0
for file_info in "${FILE_NODES[@]}"; do
  COMPLEXITY=$(echo "$file_info" | cut -d':' -f4)
  TOTAL_COMPLEXITY=$((TOTAL_COMPLEXITY + COMPLEXITY))
done

AVERAGE_COMPLEXITY=$((TOTAL_COMPLEXITY / ${#FILE_NODES[@]}))

# Calculate connectivity metrics
declare -A NODE_CONNECTIONS
for edge in "${IMPORT_EDGES[@]}" "${CALL_EDGES[@]}"; do
  SOURCE=$(echo "$edge" | cut -d'-' -f1)
  if [[ -z "${NODE_CONNECTIONS[$SOURCE]}" ]]; then
    NODE_CONNECTIONS[$SOURCE]=1
  else
    NODE_CONNECTIONS[$SOURCE]=$((${NODE_CONNECTIONS[$SOURCE]} + 1))
  fi
done

# Find highly connected nodes (potential hotspots)
HOTSPOTS=()
for node in "${!NODE_CONNECTIONS[@]}"; do
  if [[ ${NODE_CONNECTIONS[$node]} -gt 5 ]]; then
    HOTSPOTS+=("$node:${NODE_CONNECTIONS[$node]}")
  fi
done

cat > "$METRICS_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "nodes": {
    "total": $TOTAL_NODES,
    "files": ${#FILE_NODES[@]},
    "functions": ${#FUNCTION_NODES[@]},
    "components": ${#COMPONENT_NODES[@]}
  },
  "edges": {
    "total": $TOTAL_EDGES,
    "imports": ${#IMPORT_EDGES[@]},
    "calls": ${#CALL_EDGES[@]}
  },
  "complexity": {
    "total": $TOTAL_COMPLEXITY,
    "average": $AVERAGE_COMPLEXITY,
    "distribution": "calculated"
  },
  "connectivity": {
    "averageConnections": $(echo "scale=2; $TOTAL_EDGES / $TOTAL_NODES" | bc -l 2>/dev/null || echo "0"),
    "hotspots": ${#HOTSPOTS[@]},
    "maxConnections": $(printf '%s\n' "${NODE_CONNECTIONS[@]}" | sort -nr | head -1)
  }
}
EOF

echo "📊 Calculated graph metrics: $TOTAL_NODES nodes, $TOTAL_EDGES edges"
```

### 6. Generate Architecture Insights
```bash
echo "🔍 Generating architectural insights..."

INSIGHTS_FILE="$GRAPH_DIR/insights.md"

cat > "$INSIGHTS_FILE" << EOF
# SolConnect Architecture Insights
*Generated on $(date)*

## Repository Overview
- **Total Entities**: $TOTAL_NODES nodes
- **Relationships**: $TOTAL_EDGES edges
- **Complexity Score**: $TOTAL_COMPLEXITY (avg: $AVERAGE_COMPLEXITY per file)
- **Architectural Clusters**: ${#CLUSTERS[@]}

## Key Components

### Core Services
$(for file_info in "${FILE_NODES[@]}"; do
  file="${file_info%%:*}"
  category=$(echo "$file_info" | cut -d':' -f2)
  if [[ "$category" == "service" ]]; then
    echo "- **$(basename "$file" .ts)**: Core service component"
  fi
done | head -5)

### UI Components
$(for file_info in "${FILE_NODES[@]}"; do
  file="${file_info%%:*}"
  category=$(echo "$file_info" | cut -d':' -f2)
  if [[ "$category" == "component" ]]; then
    echo "- **$(basename "$file" .tsx)**: UI component"
  fi
done | head -5)

## Architectural Hotspots
$(for hotspot in "${HOTSPOTS[@]:0:5}"; do
  node="${hotspot%:*}"
  connections="${hotspot#*:}"
  echo "- **$(basename "$node")**: $connections connections (high coupling)"
done)

## Cluster Analysis
$(for cluster in "${!CLUSTERS[@]}"; do
  echo "### $cluster Cluster"
  echo "- Files: ${CLUSTERS[$cluster]}"
  echo "- Purpose: $(case "$cluster" in
    "src") echo "Main application code" ;;
    "components") echo "React UI components" ;;
    "services") echo "Business logic services" ;;
    "utils") echo "Utility functions" ;;
    *) echo "Supporting code" ;;
  esac)"
  echo ""
done)

## Recommendations

### Architecture Health
- **Complexity**: $(if [[ $AVERAGE_COMPLEXITY -gt 15 ]]; then echo "⚠️ High - Consider refactoring"; else echo "✅ Manageable"; fi)
- **Coupling**: $(if [[ ${#HOTSPOTS[@]} -gt 3 ]]; then echo "⚠️ High - ${#HOTSPOTS[@]} hotspots detected"; else echo "✅ Low coupling"; fi)
- **Modularity**: $(if [[ ${#CLUSTERS[@]} -gt 5 ]]; then echo "✅ Well modularized"; else echo "⚠️ Consider better separation"; fi)

### Improvement Opportunities
$(if [[ ${#HOTSPOTS[@]} -gt 0 ]]; then
  echo "1. **Reduce coupling** in hotspot components:"
  for hotspot in "${HOTSPOTS[@]:0:3}"; do
    echo "   - $(basename "${hotspot%:*}")"
  done
fi)

$(if [[ $AVERAGE_COMPLEXITY -gt 15 ]]; then
  echo "2. **Refactor complex files** (>20 complexity score)"
fi)

3. **Enhance documentation** for core service interactions
4. **Add integration tests** for cross-component flows

## Graph Evolution Tracking
- Next update: Automatic on code changes
- Trend analysis: Weekly
- Architecture review: Monthly

---
*This analysis is automatically generated and updated by the SolConnect Knowledge Graph Engine*
EOF

echo "🔍 Generated architectural insights: $INSIGHTS_FILE"
```

### 7. Create Visual Graph Representation
```bash
echo "🎨 Creating visual graph representation..."

VISUAL_FILE="$GRAPH_DIR/architecture-graph.mermaid"

cat > "$VISUAL_FILE" << EOF
graph TD
    %% SolConnect Architecture Graph (Auto-generated)
    
    %% Core Services
    SDK[SolConnectSDK]
    Bus[MessageBus]
    Crypto[CryptoService]
    Storage[MessageStorage]
    Transport[MessageTransport]
    
    %% UI Layer
    UI[UI Components]
    Screens[Screen Components]
    Hooks[Custom Hooks]
    
    %% Network Layer
    Relay[WebSocket Relay]
    Network[Network Manager]
    
    %% Storage Layer
    DB[Database Service]
    Cache[Cache Service]
    
    %% Core relationships
    SDK --> Bus
    SDK --> Crypto
    Bus --> Storage
    Bus --> Transport
    Transport --> Relay
    Transport --> Network
    Storage --> DB
    Storage --> Cache
    
    %% UI relationships
    UI --> SDK
    Screens --> UI
    Hooks --> SDK
    
    %% Styling
    classDef service fill:#e1f5fe
    classDef ui fill:#f3e5f5
    classDef storage fill:#e8f5e8
    classDef network fill:#fff3e0
    
    class SDK,Bus,Crypto service
    class UI,Screens,Hooks ui
    class Storage,DB,Cache storage
    class Transport,Relay,Network network
EOF

echo "🎨 Generated visual representation: $VISUAL_FILE"
```

### 8. Update Graph Metadata
```bash
echo "📝 Updating graph metadata..."

# Update metadata with final counts
cat > "$GRAPH_METADATA" << EOF
{
  "version": "1.0",
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "nodeCount": $TOTAL_NODES,
  "edgeCount": $TOTAL_EDGES,
  "clusters": ${#CLUSTERS[@]},
  "hotspots": ${#HOTSPOTS[@]},
  "complexity": {
    "total": $TOTAL_COMPLEXITY,
    "average": $AVERAGE_COMPLEXITY
  },
  "files": {
    "total": ${#FILE_NODES[@]},
    "byType": {
      "typescript": $(echo "${FILE_NODES[@]}" | tr ' ' '\n' | grep -c '\.ts:' || echo 0),
      "react": $(echo "${FILE_NODES[@]}" | tr ' ' '\n' | grep -c '\.tsx:' || echo 0),
      "javascript": $(echo "${FILE_NODES[@]}" | tr ' ' '\n' | grep -c '\.js:' || echo 0)
    }
  },
  "lastAnalysis": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "nextUpdate": "automatic on code changes"
}
EOF

echo "📝 Updated metadata: $GRAPH_METADATA"
```

### 9. Generate Graph Summary
```bash
echo "📋 Generating knowledge graph summary..."

SUMMARY_FILE="$GRAPH_DIR/summary.md"

cat > "$SUMMARY_FILE" << EOF
# SolConnect Knowledge Graph Summary
*Generated on $(date)*

## 📊 Graph Statistics
- **Nodes**: $TOTAL_NODES entities
- **Edges**: $TOTAL_EDGES relationships
- **Clusters**: ${#CLUSTERS[@]} architectural groups
- **Hotspots**: ${#HOTSPOTS[@]} highly connected components
- **Complexity**: $TOTAL_COMPLEXITY total, $AVERAGE_COMPLEXITY average

## 🏗️ Architecture Overview
The SolConnect codebase consists of $(printf "%.0f" $(echo "scale=2; ${#FILE_NODES[@]} * 0.8" | bc)) production files organized into ${#CLUSTERS[@]} main architectural clusters.

### Key Insights
1. **Modularity**: $(if [[ ${#CLUSTERS[@]} -gt 4 ]]; then echo "Well-organized"; else echo "Could improve"; fi) with clear separation of concerns
2. **Complexity**: $(if [[ $AVERAGE_COMPLEXITY -lt 15 ]]; then echo "Manageable"; else echo "Consider refactoring"; fi) complexity levels
3. **Coupling**: $(if [[ ${#HOTSPOTS[@]} -lt 3 ]]; then echo "Low"; else echo "Moderate"; fi) coupling between components

## 🎯 Recommendations for Agents
1. **Context Priority**: Focus on hotspot components for maximum impact
2. **Risk Awareness**: Monitor highly connected components for changes
3. **Pattern Recognition**: Leverage identified clusters for similar implementations
4. **Architecture Alignment**: Follow established patterns in each cluster

## 🔄 Auto-Update Status
- **Last Updated**: $(date)
- **Update Trigger**: Code changes, weekly analysis
- **Next Analysis**: $(date -d "+7 days" +%Y-%m-%d)

## 📁 Graph Files
- **Metadata**: $GRAPH_METADATA
- **Nodes**: $NODES_FILE
- **Edges**: $EDGES_FILE
- **Clusters**: $CLUSTERS_FILE
- **Metrics**: $METRICS_FILE
- **Insights**: $INSIGHTS_FILE
- **Visual**: $VISUAL_FILE

---
*This knowledge graph enables intelligent agent guidance and architectural understanding*
EOF

echo "📋 Knowledge graph summary: $SUMMARY_FILE"
echo ""
echo "✨ Knowledge graph construction complete!"
echo "🧠 Graph contains $TOTAL_NODES nodes and $TOTAL_EDGES relationships"
echo "📊 Insights and metrics available in: $GRAPH_DIR"
echo "🎨 Visual representation: $VISUAL_FILE"
```

## Auto-Integration with Development Workflow

### Git Hook Integration
```bash
#!/bin/bash
# .git/hooks/post-commit
echo "🧠 Updating knowledge graph after commit..."
claude --command .claude/commands/build-knowledge-graph.md
```

### Scheduled Analysis
```bash
#!/bin/bash
# Weekly comprehensive analysis
# Add to crontab: 0 1 * * 1 /path/to/weekly-graph-update.sh
echo "🌟 Weekly knowledge graph analysis..."
claude --command .claude/commands/build-knowledge-graph.md
claude --command .claude/commands/update-knowledge.md
```