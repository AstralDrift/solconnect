# Auto-Generate SolConnect Feature Specification

## Input
FEATURE_DESCRIPTION: $ARGUMENTS

## Process

### 1. Prime with SolConnect Context
READ @CLAUDE.md
READ @SolConnectApp/SPEC.md
RUN `eza SolConnectApp/src --tree --level 2`

### 2. Analyze Feature Requirements
```
Feature Description: FEATURE_DESCRIPTION

Analyze this feature request in the context of SolConnect's messaging architecture:

1. Which SolConnect components will this affect?
   - SolConnectSDK (main API)
   - MessageBus (event coordination) 
   - UI Components (React interface)
   - Storage (IndexedDB persistence)
   - Crypto (encryption/decryption)
   - Network (WebSocket relay)
   - Solana integration

2. What are the technical requirements?
   - Encryption/security implications
   - Real-time messaging requirements
   - Offline/sync considerations
   - Cross-platform compatibility (web/mobile)
   - Performance constraints

3. What is the complexity level?
   - SIMPLE: 1-2 files, single domain
   - MEDIUM: 2-4 files, 2-3 domains  
   - COMPLEX: 5+ files, multiple domains

4. What are the user experience requirements?
   - UI/UX considerations
   - Accessibility needs
   - Mobile responsiveness
   - Performance expectations
```

### 3. Generate Complete Specification
```
Using the SolConnect spec template (specs/spec_template.solconnect.md), create a comprehensive feature specification that includes:

1. High-Level Objective (messaging goal)
2. Mid-Level Objectives (concrete steps)
3. SolConnect Architecture Context (integration points)
4. Implementation Notes (technical requirements, conventions, dependencies)
5. Context (beginning/ending state)
6. Low-Level Tasks (prompt-ready implementation steps)

Save as: specs/spec_{feature_name}.md

Make sure each Low-Level Task includes:
- Specific prompt for implementation
- Files to CREATE/UPDATE
- Functions to CREATE/UPDATE  
- Technical details and constraints
```

### 4. Output Specification Path and Complexity
```
Generated specification: specs/spec_{feature_name}.md
Feature complexity: [SIMPLE|MEDIUM|COMPLEX]
Estimated implementation time: [X minutes/hours]
Required agents: [list of specialist agents needed]
```