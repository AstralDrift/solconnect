# SolConnect Feature Implementation Workflow

## Simple 3-Step Process

### Step 1: Feature Description → Auto-Spec Generation
```bash
# Just describe what you want in natural language
claude --command .claude/commands/generate-spec.md "I want users to be able to react to messages with emojis"
```

### Step 2: Auto-Complexity Detection & Agent Assignment  
```bash
# System automatically determines complexity and routes to appropriate agents
claude --command .claude/commands/auto-implement.md "specs/spec_message_reactions.md"
```

### Step 3: Validation & Integration
```bash
# Automatic testing, linting, and integration
claude --command .claude/commands/validate-implementation.md
```

## That's it! The system handles everything else.

---

## What Happens Behind the Scenes

### For Simple Features (Single File Changes)
```
Your description → Generated spec → Single specialist agent → Implementation → Done
```

### For Medium Features (2-3 Components)
```
Your description → Generated spec → Primary + supporting agents → Coordinated implementation → Integration → Done
```

### For Complex Features (System-wide Changes)
```
Your description → Generated spec → 3 parallel agent teams → Best implementation selection → Hybrid creation → Done
```

## Example Usage

### Example 1: Simple Feature
```bash
# User input
claude --feature "Add a typing indicator when someone is composing a message"

# System output
✅ Feature classified as: SIMPLE (UI + Message Flow)
📝 Generated spec: specs/spec_typing_indicator.md
🤖 Assigned to: ui-specialist + message-flow-specialist
⚡ Implementation time: ~15 minutes
✅ Tests passed, feature ready!
```

### Example 2: Complex Feature  
```bash
# User input
claude --feature "Add end-to-end encrypted voice messages with offline playback"

# System output
✅ Feature classified as: COMPLEX (All layers affected)
📝 Generated spec: specs/spec_voice_messages.md
🔄 Creating 3 parallel implementations...
⏱️  Team 1 (Security-first): 45 minutes
⏱️  Team 2 (Performance-first): 38 minutes  
⏱️  Team 3 (UX-first): 52 minutes
🔍 Evaluating implementations...
✨ Creating hybrid from best components...
✅ Tests passed, feature ready!
```

## Advanced Usage

### Custom Constraints
```bash
claude --feature "Add message search" --constraints "mobile-optimized,<50ms-response"
```

### Specific Agent Assignment
```bash
claude --feature "Fix encryption bug" --agent crypto-specialist
```

### Development Mode (See What's Happening)
```bash
claude --feature "Add reactions" --verbose --parallel-count 2
```