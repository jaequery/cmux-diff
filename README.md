# cmux-diff

A Cursor / VSCode style Changes panel for the [cmux](https://cmux.dev) terminal environment. See which files changed, click to view syntax-highlighted diffs, including ability to generate AI-generated commit messages.

<img width="1512" height="1038" alt="image" src="https://github.com/user-attachments/assets/cf695b8a-8ad0-4035-9034-7af775cb77b4" />


## Features

- **File sidebar** — see all changed files at a glance with status badges (Added, Modified, Deleted, Renamed, Untracked)
- **Syntax-highlighted diffs** — powered by Shiki with GitHub Dark theme
- **Multi-file selection** — Cmd/Ctrl+click to select multiple files, Cmd/Ctrl+A to select all
- **Real-time updates** — WebSocket-powered live refresh when files change
- **Resizable sidebar** — drag to resize, width persisted across sessions
- **Keyboard navigation** — j/k or arrow keys to move between files
- **Smart diff range** — auto-detects feature branches and diffs against merge-base
- **cmux integration** — opens in cmux browser split, auto-shutdown on tab close
- **Dark theme** — GitHub-dark color palette designed for code review

## Installation

### Option 1: Clone & run (requires Bun)

```bash
git clone https://github.com/jaequery/cmux-diff.git
cd cmux-diff
bun install
```

Run it:

```bash
# Dev mode (opens in default browser)
bun run dev

# With cmux (opens in cmux browser split)
bun run start -- /path/to/your/repo
```

### Option 2: Standalone binary

```bash
git clone https://github.com/jaequery/cmux-diff.git
cd cmux-diff
bun install
bun run build:compile
```

Copy the binary to your PATH:

```bash
cp bin/cmux-diff ~/.local/bin/
```

Then run from any git repo:

```bash
cmux-diff /path/to/repo
cmux-diff              # uses current directory
```

### Option 3: Global install via Bun

```bash
bun install -g ./cmux-diff
cmux-diff
```

## Usage

```
cmux-diff [options] [directory]

Options:
  -p, --port <port>   Port to listen on (default: random)
  --dry-run            Don't connect to cmux socket
  -h, --help           Show this help
```

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `j` / `Arrow Down` | Next file |
| `k` / `Arrow Up` | Previous file |
| `Cmd/Ctrl + A` | Select all files |
| `Cmd/Ctrl + Click` | Toggle file selection |

### Multi-file selection

- **Click** a file to view its diff
- **Cmd/Ctrl+click** to add/remove files from selection — diffs are shown stacked
- **Select all** button or Cmd/Ctrl+A to view all diffs at once

## Claude Code Skill

To use as a Claude Code skill (`/cmux-diff:start`), copy the skill to your project:

```bash
mkdir -p .claude/skills/cmux-diff
cp /path/to/cmux-diff/skills/start/SKILL.md .claude/skills/cmux-diff/start.md
```

Or add to your global Claude Code skills directory.

## API

The server exposes these endpoints on localhost:

| Endpoint | Description |
|----------|-------------|
| `GET /api/diff/files` | List changed files with status |
| `GET /api/diff/file?path=` | Get diff for a single file with syntax tokens |
| `GET /api/status` | Current branch and working directory |
| `GET /api/branches` | List branches |
| `WS /ws` | WebSocket for real-time `diff-updated` events |

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Frontend**: React 19, Tailwind CSS v4
- **Syntax highlighting**: [Shiki](https://shiki.style) with GitHub Dark theme
- **cmux integration**: Unix domain socket (JSON-RPC)

## Development

```bash
bun install
bun run dev                # Dev server with hot reload
bun run typecheck          # TypeScript check
bun run build:compile      # Build standalone binary
```

## License

MIT
