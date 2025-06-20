# SolConnect Agentic Development - Quick Start Guide

## 🚀 Super Simple Usage

### Method 1: One-Line Feature Implementation
```bash
# Just describe what you want - the system does everything else
claude --feature "Add emoji reactions to messages"
```

### Method 2: Step-by-Step Control
```bash
# Step 1: Generate specification from description
claude --command .claude/commands/generate-spec.md "Add typing indicators"

# Step 2: Auto-implement using the generated spec  
claude --command .claude/commands/auto-implement.md "specs/spec_typing_indicators.md"

# Step 3: Validate (done automatically, but you can run manually)
claude --command .claude/commands/validate-implementation.md
```

## 📋 Common Examples

### Simple Features (10-30 minutes)
```bash
# UI-only changes
claude --feature "Make message bubbles have rounded corners"
claude --feature "Add dark mode toggle to settings"
claude --feature "Show user avatar next to messages"

# Single service updates
claude --feature "Add message timestamp formatting"
claude --feature "Implement message character limit"
```

### Medium Features (30-90 minutes)  
```bash
# Multi-component features
claude --feature "Add message reactions with emoji picker"
claude --feature "Show typing indicators when someone is writing"
claude --feature "Add message status indicators (sent/delivered/read)"

# Integration features
claude --feature "Add message search with filters"
claude --feature "Implement message forwarding between chats"
```

### Complex Features (2-4 hours)
```bash
# System-wide features (uses parallel development automatically)
claude --feature "Add end-to-end encrypted voice messages"
claude --feature "Implement multi-device message synchronization" 
claude --feature "Add encrypted file sharing with offline download"
```

## 🎛️ Advanced Options

### Specify Constraints
```bash
claude --feature "Add video calls" --constraints "mobile-optimized,low-bandwidth"
claude --feature "Add search" --constraints "privacy-focused,<100ms-response"
```

### Force Specific Implementation Strategy
```bash
# Force single agent (even for complex features)
claude --feature "Add reactions" --strategy single --agent ui-specialist

# Force parallel development (even for simple features) 
claude --feature "Fix button styling" --strategy parallel --teams 2
```

### Development Mode (See What's Happening)
```bash
# Verbose output showing agent decisions and progress
claude --feature "Add mentions" --verbose

# Show parallel development in real-time
claude --feature "Add search" --strategy parallel --watch
```

## 📁 What Gets Created

### For Any Feature:
```
specs/
└── spec_your_feature.md          # Auto-generated specification

.claude/evaluations/               # Implementation results (for complex features)
└── your_feature-evaluation.md    # Comparative analysis and decisions
```

### For Complex Features:
```
dev-trees/                        # Temporary parallel development (auto-cleaned)
├── your_feature-v1/              # Team 1 implementation  
├── your_feature-v2/              # Team 2 implementation
└── your_feature-v3/              # Team 3 implementation
```

## 🔧 Configuration

### Set Default Preferences
```bash
# Create .claude/config.json
{
  "defaultStrategy": "auto",      // auto|single|coordinated|parallel
  "parallelTeams": 3,             // number of parallel teams for complex features
  "autoValidation": true,         // run validation automatically
  "verboseOutput": false,         // show detailed progress
  "mobileOptimized": true,        // always consider mobile compatibility
  "performanceFirst": false       // prioritize performance over other factors
}
```

## 🎯 Pro Tips

### 1. Be Specific About Requirements
```bash
# Vague (will ask for clarification)
claude --feature "Make messages better"

# Specific (immediate implementation)
claude --feature "Add read receipts that show when each user has read a message"
```

### 2. Use Domain-Specific Language
```bash
# Use SolConnect terminology for better context
claude --feature "Add message reactions using SolConnect's encryption pipeline"
claude --feature "Implement typing indicators through the MessageBus event system"
```

### 3. Specify Performance Requirements
```bash
claude --feature "Add search with <50ms response time for 10k+ messages"
claude --feature "Add image uploads with progressive loading and compression"
```

### 4. Leverage Existing Patterns
```bash
claude --feature "Add message deletion following the same pattern as message editing"
claude --feature "Implement group chat invites using existing wallet verification"
```

## 🚨 What to Expect

### Simple Features
- ✅ Implemented in 10-30 minutes
- ✅ Single agent handles everything
- ✅ Automatic testing and validation
- ✅ Ready to use immediately

### Medium Features  
- ✅ Implemented in 30-90 minutes
- ✅ 2-3 specialist agents coordinate
- ✅ Comprehensive testing
- ✅ Integration validation

### Complex Features
- ✅ Implemented in 2-4 hours
- ✅ 3 parallel teams explore different approaches
- ✅ Automatic evaluation and hybrid creation
- ✅ Performance benchmarking
- ✅ Architecture review

## 🔍 Monitoring Progress

### Check Current Status
```bash
# See what the system is working on
claude --status

# View detailed progress for complex features
claude --status --verbose
```

### View Implementation History
```bash
# See all implemented features
ls .claude/evaluations/

# Review specific feature implementation
cat .claude/evaluations/message_reactions-evaluation.md
```

---

**That's it!** Just describe what you want and the system handles the complexity, routing, agent coordination, and implementation automatically. 🎉