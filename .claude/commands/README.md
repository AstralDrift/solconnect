# SolConnect Custom Slash Commands

This directory contains custom slash command templates for Claude Code to help with common SolConnect development workflows.

## Available Commands

### 🐛 `/debug-issue`
**Purpose**: Systematically debug issues in the SolConnect codebase

**Usage**: `/debug-issue [component] [error description]`

**Example**: 
```
/debug-issue WebSocket connection dropping after 30 seconds
/debug-issue MessageBubble component not updating on new messages
```

**What it does**:
- Analyzes the error systematically
- Checks common patterns for the component type
- Suggests fixes with proper error handling
- Provides debugging commands and tools
- Ensures fixes include tests

### 🔧 `/refactor-module`
**Purpose**: Safely refactor modules while maintaining functionality

**Usage**: `/refactor-module [module path] [refactoring goal]`

**Example**:
```
/refactor-module src/services/SolConnectSDK.ts split into smaller services
/refactor-module src/screens/ChatThreadScreen.tsx extract message logic to custom hook
```

**What it does**:
- Analyzes current module structure and dependencies
- Creates a safe refactoring plan
- Maintains backward compatibility
- Updates tests and documentation
- Provides rollback instructions

### 🧪 `/add-test`
**Purpose**: Implement Test-Driven Development (TDD) workflow

**Usage**: `/add-test [component/service/function] [test scenario]`

**Example**:
```
/add-test MessageInput component should handle emoji input
/add-test SolConnectSDK.sendMessage should retry on network failure
```

**What it does**:
- Writes failing tests first (Red phase)
- Implements minimal code to pass (Green phase)
- Refactors for quality (Refactor phase)
- Provides test templates for different types
- Includes edge cases and integration tests

### 👀 `/review-pr`
**Purpose**: Conduct thorough code reviews with security and performance focus

**Usage**: `/review-pr [PR number or branch name] [focus areas]`

**Example**:
```
/review-pr #123 security and performance
/review-pr feature/group-chat focus on WebSocket changes
```

**What it does**:
- Fetches and analyzes PR changes
- Checks security vulnerabilities
- Reviews performance implications
- Verifies test coverage
- Ensures code follows project conventions
- Provides actionable feedback

## How Slash Commands Work

1. **Template Processing**: Each command uses `$ARGUMENTS` placeholder for user input
2. **Thinking Mode**: Commands include `<thinking>` blocks for Claude's analysis
3. **Structured Approach**: Each command follows a step-by-step workflow
4. **Project-Specific**: Templates are tailored to SolConnect's architecture and conventions

## Creating New Commands

To add a new slash command:

1. Create a new `.md` file in this directory
2. Use this template structure:
   ```markdown
   # Command Name
   
   ## Usage
   `/command-name [arguments]`
   
   ## Purpose
   Brief description
   
   ## Instructions
   
   <thinking>
   Analysis steps for Claude
   </thinking>
   
   Main content with $ARGUMENTS placeholder
   ```

3. Include project-specific patterns and conventions
4. Add examples and code snippets
5. Provide clear action items

## Best Practices

1. **Be Specific**: Reference SolConnect's actual file structure and patterns
2. **Include Examples**: Show real code from the project when possible
3. **Think Step-by-Step**: Break complex tasks into manageable steps
4. **Provide Options**: Give alternatives for different scenarios
5. **Focus on Safety**: Always include rollback/recovery options

## Integration with Claude Code

These commands work best when:
- The project context is loaded (CLAUDE.md file)
- MCP servers are configured (.mcp.json)
- Recent changes are visible in the workspace
- Test files are accessible

## Tips for Effective Use

1. **Provide Context**: Include specific file paths or component names
2. **Be Clear**: Describe the issue or goal clearly
3. **Iterate**: Commands can be run multiple times with refinements
4. **Combine Commands**: Use multiple commands for complex workflows
   ```
   /add-test NewFeature basic functionality
   /refactor-module src/old-feature.ts integrate NewFeature
   /review-pr feature/new-feature final review
   ```

## Troubleshooting

If a command doesn't work as expected:
1. Check that you're providing the right arguments
2. Ensure the file paths are correct
3. Verify that dependencies are installed
4. Make sure tests are passing before refactoring

## Contributing

To improve these commands:
1. Use them in real scenarios
2. Note what's missing or could be better
3. Update the templates with improvements
4. Add new commands for repeated workflows
5. Share feedback with the team

---

*These custom commands are designed to accelerate SolConnect development while maintaining code quality and consistency.* 