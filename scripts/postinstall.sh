#!/bin/sh
# Install cmux-diff as a Claude Code global skill
SKILL_DIR="$HOME/.claude/skills/cmux-diff"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_SRC="$SCRIPT_DIR/../skills/start/SKILL.md"

if [ -d "$HOME/.claude" ] && [ -f "$SKILL_SRC" ]; then
  mkdir -p "$SKILL_DIR"
  cp "$SKILL_SRC" "$SKILL_DIR/SKILL.md"
  echo "cmux-diff: Claude Code skill installed (/cmux-diff)"
fi
