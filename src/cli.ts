#!/usr/bin/env bun

import { createApp } from "../server/app";
import { CmuxClient } from "../server/cmux";
import path from "path";

async function main() {
  const args = process.argv.slice(2);
  let port: number | undefined;
  let targetDir: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "-p" || arg === "--port") && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "-h" || arg === "--help") {
      console.log(`cmux-diff - Changes panel for cmux

Usage: cmux-diff [options] [directory]

Options:
  -p, --port <port>   Port to listen on (default: random)
  --dry-run            Don't connect to cmux socket
  -h, --help           Show this help`);
      process.exit(0);
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
  const serverUrl = `http://127.0.0.1:${app.server.port}`;

  console.log(`cmux-diff running at ${serverUrl}`);
  console.log(`Watching: ${cwd}`);

  // Open in cmux browser
  if (!dryRun) {
    try {
      const proc = Bun.spawn(["cmux", "browser", "open-split", serverUrl], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;
      if (exitCode === 0) {
        console.log(`Browser opened: ${stdout.trim()}`);
      } else {
        console.error(`cmux browser failed (exit ${exitCode}): ${stderr.trim()}`);
        console.log(`Open ${serverUrl} in your browser`);
      }
    } catch (e) {
      console.error(`cmux browser error: ${e}`);
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
