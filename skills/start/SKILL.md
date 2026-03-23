---
name: cmux-diff
description: >
  Start cmux-diff (VSCode-style changes panel) to view changed files and diffs
  in a sidebar layout. Use when user says "/cmux-diff", "show changes",
  "changes panel", or "diff viewer".
---

# cmux-diff: Changes Panel

Start the cmux-diff changes panel for the current working directory.

## Steps

1. Run the following bash commands to start cmux-diff:

```bash
CMUX_DIFF_DIR="${HOME}/Scripts/cmux-diff"
TARGET_DIR="$PWD"

# Ensure dependencies are installed
if [ ! -d "$CMUX_DIFF_DIR/node_modules" ]; then
  echo "Installing cmux-diff dependencies..."
  (cd "$CMUX_DIFF_DIR" && bun install)
fi

# Setup logging
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/cmux-diff"
mkdir -p "$LOG_DIR"
PROJECT_NAME="$(basename "$TARGET_DIR")"
TIMESTAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
LOG_FILE="${LOG_DIR}/${PROJECT_NAME}-${TIMESTAMP}.log"

# Start server in background with --dry-run (we open browser separately)
echo "[${TIMESTAMP}] Starting cmux-diff (pwd: $TARGET_DIR)" >> "$LOG_FILE"
(cd "$CMUX_DIFF_DIR" && bun run src/cli.ts --dry-run "$TARGET_DIR" >> "$LOG_FILE" 2>&1) &
disown

# Wait for server to start and extract port from log
for i in 1 2 3 4 5 6 7 8; do
  sleep 1
  PORT=$(grep -o 'http://127.0.0.1:[0-9]*' "$LOG_FILE" | head -1 | grep -o '[0-9]*$')
  if [ -n "$PORT" ]; then
    break
  fi
done

if [ -n "$PORT" ]; then
  # Open as new tab (default)
  cmux browser open "http://127.0.0.1:$PORT"
  echo "cmux-diff opened at http://127.0.0.1:$PORT for $TARGET_DIR"
else
  echo "cmux-diff server started but could not detect port. Check $LOG_FILE"
fi
```

2. Confirm to the user that cmux-diff has been started and is showing in their cmux browser panel.
