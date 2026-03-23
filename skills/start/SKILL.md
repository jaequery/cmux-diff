---
description: Start cmux-diff (changes panel) in the current project
---

Start cmux-diff for the current working directory.

Run the following commands:

```bash
# Check if cmux-diff binary exists, build if needed
CMUX_DIFF_DIR="${HOME}/Scripts/cmux-diff"
CMUX_DIFF_BIN="${CMUX_DIFF_DIR}/bin/cmux-diff"

if [ ! -f "$CMUX_DIFF_BIN" ]; then
  echo "Building cmux-diff..."
  cd "$CMUX_DIFF_DIR"
  bun install --frozen-lockfile 2>/dev/null || bun install
  bun run build:compile
  cd - > /dev/null
fi

# Setup logging
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/cmux-diff"
mkdir -p "$LOG_DIR"
PROJECT_NAME="$(basename "$PWD")"
TIMESTAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
LOG_FILE="${LOG_DIR}/${PROJECT_NAME}-${TIMESTAMP}.log"

# Start cmux-diff in background
echo "[${TIMESTAMP}] Starting cmux-diff (pwd: $PWD)" >> "$LOG_FILE"
"$CMUX_DIFF_BIN" "$PWD" >> "$LOG_FILE" 2>&1 &
disown
```
