# Context Management System

This directory contains tools and documentation to help maintain development context across sessions, reduce cognitive load, and improve development efficiency.

## Directory Structure

```
.context/
├── README.md                 # This file
├── current-work.md          # Active work tracking
├── architecture-map.md      # Quick architecture reference
├── decision-log.md          # Architecture decisions and rationale
├── code-patterns.md         # Common patterns and examples
├── troubleshooting.md       # Common issues and solutions
├── api-reference.md         # Quick API reference
├── dependencies.md          # Dependency map and rationale
└── scripts/
    ├── generate-context.sh  # Auto-generate context files
    ├── update-summary.sh    # Update work summaries
    └── analyze-changes.sh   # Analyze recent changes
```

## Quick Start for New Sessions

1. **Read Current Work**: Start with `current-work.md` to understand what's in progress
2. **Check Architecture**: Review `architecture-map.md` for system overview
3. **Review Patterns**: Check `code-patterns.md` for established conventions
4. **Run Context Script**: Execute `./scripts/generate-context.sh` for latest state

## Maintaining Context

### After Each Work Session
1. Update `current-work.md` with progress
2. Add any new decisions to `decision-log.md`
3. Document new patterns in `code-patterns.md`
4. Run `./scripts/update-summary.sh`

### Starting New Features
1. Document the plan in `current-work.md`
2. Check `architecture-map.md` for affected components
3. Review related patterns in `code-patterns.md`
4. Update `decision-log.md` with approach rationale

## Key Commands

```bash
# Generate fresh context summary
./scripts/generate-context.sh

# Update work summary
./scripts/update-summary.sh

# Analyze recent changes
./scripts/analyze-changes.sh

# Quick architecture view
cat architecture-map.md

# Current work status
cat current-work.md
```

## Best Practices

1. **Keep Summaries Concise**: Focus on what's essential for context
2. **Update Regularly**: Small, frequent updates are better than large, infrequent ones
3. **Link Related Items**: Reference related files and decisions
4. **Use Examples**: Include code snippets in patterns documentation
5. **Track Rationale**: Always document the "why" behind decisions 