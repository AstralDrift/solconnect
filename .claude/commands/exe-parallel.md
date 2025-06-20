# Parallel SolConnect Feature Execution

## Variables
SPEC_TO_EXECUTE: $ARGUMENTS
NUMBER_OF_PARALLEL_WORKTREES: $ARGUMENTS

## Run these commands first
RUN `eza SolConnectApp --tree --level 3 --git-ignore`
RUN `eza core --tree --level 2 --git-ignore`
RUN `eza dev-trees --tree --level 3` (if exists)
READ: SPEC_TO_EXECUTE

## Instructions

We're creating NUMBER_OF_PARALLEL_WORKTREES subagents using the Task tool to implement the same SolConnect feature in parallel across isolated worktrees.

This enables concurrent development with comparative evaluation to select the optimal implementation.

**Workspace Structure:**
- Agent 1: `dev-trees/{feature_name}-v1/`
- Agent 2: `dev-trees/{feature_name}-v2/`
- Agent N: `dev-trees/{feature_name}-vN/`

Each workspace contains a complete SolConnect codebase with isolated development environments.

**Agent Instructions:**
1. Implement the engineering specification from SPEC_TO_EXECUTE
2. Focus on SolConnect messaging architecture patterns
3. Follow TypeScript/React/Rust conventions from CLAUDE.md
4. Test changes with `npm test` and `npm run lint`
5. Create comprehensive `RESULTS.md` documenting:
   - Implementation approach and rationale  
   - Code changes made (files/functions modified)
   - Testing results and performance impact
   - Trade-offs and alternative approaches considered
   - Integration points with SolConnect's message flow

**SolConnect-Specific Considerations:**
- Message encryption/decryption flow
- WebSocket relay integration  
- Wallet connection management
- Solana blockchain interactions
- React component patterns
- State management (Redux)

Agents should NOT start development servers - focus purely on code implementation and testing.