import { type ServerWebSocket } from "bun";
import { Git } from "./git";
import { FileWatcher } from "./watcher";
import { highlightCode, detectLanguage } from "./highlighter";
import { validateRequest, securityHeaders } from "./middleware/security";
import path from "path";

export interface AppOptions {
  cwd: string;
  port?: number;
  dryRun?: boolean;
}

interface DiffFileResponse {
  path: string;
  oldPath?: string;
  status: string;
  diff: string;
  tokens?: { content: string; color?: string }[][];
}

const srcDir = path.join(import.meta.dir, "..", "src");
const distDir = path.join(import.meta.dir, "..", ".dist");

async function buildFrontend(): Promise<boolean> {
  const tailwind = (await import("bun-plugin-tailwind")).default;
  const result = await Bun.build({
    entrypoints: [path.join(srcDir, "index.html")],
    outdir: distDir,
    plugins: [tailwind],
    target: "browser",
    sourcemap: "linked",
  });
  if (!result.success) {
    console.error("Frontend build failed:", result.logs);
    return false;
  }
  return true;
}

export async function createApp(options: AppOptions) {
  // Build frontend
  await buildFrontend();

  const git = new Git(options.cwd);
  const clients = new Set<ServerWebSocket<unknown>>();

  let watcher: FileWatcher | null = null;

  async function startWatcher() {
    try {
      const gitDir = await git.getGitDir();
      const resolvedGitDir = gitDir.startsWith("/")
        ? gitDir
        : `${options.cwd}/${gitDir}`;
      watcher = new FileWatcher(options.cwd, resolvedGitDir);
      watcher.onChanged(() => {
        broadcast({ type: "diff-updated" });
      });
      await watcher.start();
    } catch {
      watcher = new FileWatcher(options.cwd);
      watcher.onChanged(() => {
        broadcast({ type: "diff-updated" });
      });
      await watcher.start();
    }
  }

  function broadcast(message: unknown) {
    const data = JSON.stringify(message);
    for (const ws of clients) {
      try {
        ws.send(data);
      } catch {
        clients.delete(ws);
      }
    }
  }

  async function handleApi(req: Request, url: URL): Promise<Response> {
    const headers = securityHeaders();
    const pathname = url.pathname;

    try {
      if (pathname === "/api/status") {
        const branch = await git.getBranch();
        return Response.json({ branch, cwd: options.cwd }, { headers });
      }

      if (pathname === "/api/diff/files") {
        const base = url.searchParams.get("base") || undefined;
        const target = url.searchParams.get("target") || undefined;

        let effectiveBase = base;
        let effectiveTarget = target;
        if (!base && !target) {
          const range = await git.computeDiffRange();
          if (range) {
            effectiveBase = range.base;
            effectiveTarget = range.target;
          }
        }

        const files = await git.getChangedFiles(effectiveBase, effectiveTarget);

        if (effectiveBase && effectiveTarget) {
          const workingFiles = await git.getChangedFiles();
          for (const wf of workingFiles) {
            if (!files.some((f) => f.path === wf.path)) {
              files.push(wf);
            }
          }
          files.sort((a, b) => a.path.localeCompare(b.path));
        }

        return Response.json({ files }, { headers });
      }

      if (pathname === "/api/diff/file") {
        const filePath = url.searchParams.get("path");
        if (!filePath) {
          return Response.json(
            { error: "path required" },
            { status: 400, headers }
          );
        }

        const base = url.searchParams.get("base") || undefined;
        const target = url.searchParams.get("target") || undefined;
        const context = parseInt(url.searchParams.get("context") || "3", 10);

        let effectiveBase = base;
        let effectiveTarget = target;
        if (!base && !target) {
          const range = await git.computeDiffRange();
          if (range) {
            effectiveBase = range.base;
            effectiveTarget = range.target;
          }
        }

        const files = await git.getChangedFiles(effectiveBase, effectiveTarget);
        const fileInfo = files.find((f) => f.path === filePath);

        let diff: string;
        if (fileInfo?.status === "untracked") {
          diff = await git.getUntrackedFileDiff(filePath);
        } else {
          diff = await git.getFileDiff(filePath, effectiveBase, effectiveTarget, context);
          if (!diff && effectiveBase && effectiveTarget) {
            diff = await git.getFileDiff(filePath, undefined, undefined, context);
          }
        }

        const lang = detectLanguage(filePath);
        let tokens: { content: string; color?: string }[][] | undefined;

        if (diff && lang) {
          const lines = diff.split("\n");
          const codeLines: string[] = [];
          for (const line of lines) {
            if (
              line.startsWith("+") &&
              !line.startsWith("+++") &&
              !line.startsWith("+++ ")
            ) {
              codeLines.push(line.slice(1));
            } else if (
              line.startsWith("-") &&
              !line.startsWith("---") &&
              !line.startsWith("--- ")
            ) {
              codeLines.push(line.slice(1));
            } else if (line.startsWith(" ")) {
              codeLines.push(line.slice(1));
            }
          }
          if (codeLines.length > 0) {
            tokens = await highlightCode(codeLines.join("\n"), lang);
          }
        }

        const response: DiffFileResponse = {
          path: filePath,
          oldPath: fileInfo?.oldPath,
          status: fileInfo?.status || "modified",
          diff,
          tokens,
        };

        return Response.json(response, { headers });
      }

      if (pathname === "/api/branches") {
        const branches = await git.getBranches();
        return Response.json(branches, { headers });
      }

      if (pathname === "/api/commit/message") {
        const message = await git.generateCommitMessage();
        return Response.json({ message }, { headers });
      }

      if (pathname === "/api/commit" && req.method === "POST") {
        const body = (await req.json()) as { message: string };
        if (!body.message?.trim()) {
          return Response.json(
            { error: "commit message required" },
            { status: 400, headers }
          );
        }
        // Stage all changes first
        await git.stageAll();
        const hash = await git.commit(body.message.trim());
        return Response.json({ hash, ok: true }, { headers });
      }

      return Response.json({ error: "not found" }, { status: 404, headers });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return Response.json({ error: message }, { status: 500, headers });
    }
  }

  await startWatcher();

  const server = Bun.serve({
    port: options.port || 0,
    hostname: "127.0.0.1",
    idleTimeout: 120,

    async fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade
      if (url.pathname === "/ws") {
        if (server.upgrade(req)) return;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // Security check
      const securityError = validateRequest(req);
      if (securityError) return securityError;

      // API routes
      if (url.pathname.startsWith("/api/")) {
        return handleApi(req, url);
      }

      // Serve built frontend files
      const filePath =
        url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const file = Bun.file(path.join(distDir, filePath));
      if (await file.exists()) {
        return new Response(file);
      }

      // SPA fallback — serve index.html for any unmatched route
      return new Response(Bun.file(path.join(distDir, "index.html")));
    },

    websocket: {
      open(ws) {
        clients.add(ws);
      },
      close(ws) {
        clients.delete(ws);
      },
      message() {},
    },
  });

  return {
    server,
    broadcast,
    stop() {
      watcher?.stop();
      server.stop();
    },
  };
}
