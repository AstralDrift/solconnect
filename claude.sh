#!/bin/bash

# claude.sh - Main CLI for the SolConnect AI Agent Heaven

COMMAND_DIR="./.claude/commands"
INTELLIGENCE_DIR="./.claude/intelligence"

function show_help() {
  echo "Usage: claude.sh [command] [arguments]"
  echo ""
  echo "Commands:"
  echo "  --feature <description>    Implement a new feature."
  echo "  --context-for <target>     Generate context for a file, function, or feature."
  echo "  --command <path> [args]    Execute a specific Markdown command file."
  echo "  --help                     Show this help message."
  echo ""
  echo "For more details, see the .claude/README.md"
}

function execute_markdown_command() {
  local cmd_path="$1"
  shift
  local args="$@"

  if [[ ! -f "$cmd_path" ]]; then
    echo "Error: Command file not found: $cmd_path"
    exit 1
  fi

  echo "Executing command: $cmd_path with args: $args"

  # Extract bash code blocks from Markdown and execute them
  # This is a simplified approach. A more robust solution would parse Markdown more carefully.
  # For now, it assumes bash code blocks are clearly delineated.
  awk '/```bash/,/```/{if (!/```/) print}' "$cmd_path" | bash -s -- $args
  if [ $? -ne 0 ]; then
    echo "Error: Command execution failed."
    exit 1
  fi
}

# Main logic
case "$1" in
  --feature)
    shift
    # This will eventually route to auto-implement.md
    echo "Feature implementation not yet fully integrated. Desired feature: $@"
    echo "Please use --command ./.claude/commands/auto-implement.md "<spec_file>" for now."
    ;;
  --context-for)
    shift
    execute_markdown_command "$COMMAND_DIR/smart-context.md" "$@"
    ;;
  --command)
    shift
    cmd_file="$1"
    shift
    execute_markdown_command "$cmd_file" "$@"
    ;;
  --help)
    show_help
    ;;
  *)
    echo "Unknown command: $1"
    show_help
    exit 1
    ;;
esac
