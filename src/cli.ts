#!/usr/bin/env bun

import { createApp } from "../server/app";
import { CmuxClient } from "../server/cmux";
import path from "path";

type Direction = "tab" | "right" | "bottom" | "left" | "top";

function buildBrowserCommand(
  direction: Direction,
  url: string
): { cmd: string[]; label: string } {
  switch (direction) {
    case "tab":
      return { cmd: ["cmux", "new-surface", "--type", "browser", "--url", url], label: "new tab" };
    case "right":
      return {
        cmd: ["cmux", "new-pane", "--type", "browser", "--direction", "right", "--url", url],
        label: "right split",
      };
    case "bottom":
      return {
        cmd: ["cmux", "new-pane", "--type", "browser", "--direction", "down", "--url", url],
        label: "bottom split",
      };
    case "left":
      return {
        cmd: ["cmux", "new-pane", "--type", "browser", "--direction", "left", "--url", url],
        label: "left split",
      };
    case "top":
      return {
        cmd: ["cmux", "new-pane", "--type", "browser", "--direction", "up", "--url", url],
        label: "top split",
      };
  }
}

async function main() {
  const args = process.argv.slice(2);
  let port: number | undefined;
  let targetDir: string | undefined;
  let dryRun = false;
  let direction: Direction = "tab";
  let commits: number | undefined;
  let mode: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "-p" || arg === "--port") && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if ((arg === "-d" || arg === "--direction") && args[i + 1]) {
      const val = args[i + 1].toLowerCase();
      if (["tab", "right", "bottom", "left", "top"].includes(val)) {
        direction = val as Direction;
      } else {
        console.error(`Invalid direction: ${val}. Use: tab, right, bottom, left, top`);
        process.exit(1);
      }
      i++;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "-h" || arg === "--help") {
      console.log(`cmux-diff - Changes panel for cmux

Usage: cmux-diff [options] [directory]

Options:
  -d, --direction <dir>  How to open the panel (default: tab)
                         tab, right, bottom, left, top
  -p, --port <port>      Port to listen on (default: random)
  --dry-run              Don't connect to cmux socket
  -h, --help             Show this help

Examples:
  cmux-diff              Show working tree changes (default)
  cmux-diff 1            Show diff from the last commit
  cmux-diff 3            Show diff from the last 3 commits
  cmux-diff log          Browse recent commits interactively
  cmux-diff -d bottom    Open as bottom split
  cmux-diff -d right     Open as right split`);
      process.exit(0);
    } else if (arg === "log") {
      mode = "log";
    } else if (!arg.startsWith("-") && /^\d+$/.test(arg)) {
      commits = parseInt(arg, 10);
    } else if (!arg.startsWith("-")) {
      targetDir = arg;
    }
  }

  const cmux = new CmuxClient(dryRun);

  // Resolve target directory
  if (!targetDir) {
    try {
      const state = await cmux.getSidebarState();
      if (state?.cwd) {
        targetDir = state.cwd;
      }
    } catch {
      // ignore
    }
  }

  const cwd = path.resolve(targetDir || process.cwd());

  const app = await createApp({ cwd, port, dryRun });
  let serverUrl = `http://127.0.0.1:${app.server.port}`;
  const urlParams: string[] = [];
  if (commits) urlParams.push(`commits=${commits}`);
  if (mode) urlParams.push(`mode=${mode}`);
  if (urlParams.length > 0) serverUrl += `?${urlParams.join("&")}`;

  console.log(`cmux-diff running at ${serverUrl}`);
  console.log(`Watching: ${cwd}`);

  // Open in cmux browser
  if (!dryRun) {
    try {
      const { cmd, label } = buildBrowserCommand(direction, serverUrl);
      const proc = Bun.spawn(cmd, {
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;
      if (exitCode === 0) {
        console.log(`Opened as ${label}: ${stdout.trim()}`);
      } else {
        console.error(`cmux failed (exit ${exitCode}): ${stderr.trim()}`);
        console.log(`Open ${serverUrl} in your browser`);
      }
    } catch (e) {
      console.error(`cmux error: ${e}`);
      console.log(`Open ${serverUrl} in your browser`);
    }
  } else {
    console.log(`Open ${serverUrl} in your browser`);
  }

  // Handle shutdown
  process.on("SIGINT", () => {
    app.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    app.stop();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
