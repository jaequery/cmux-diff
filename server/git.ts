export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "untracked";
  additions?: number;
  deletions?: number;
}

export interface LogEntry {
  hash: string;
  message: string;
  date: string;
}

export class Git {
  constructor(private cwd: string) {}

  private async run(args: string[]): Promise<string> {
    const proc = Bun.spawn(["git", ...args], {
      cwd: this.cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`git ${args[0]} failed: ${stderr.trim()}`);
    }
    return stdout;
  }

  async getBranch(): Promise<string> {
    try {
      return (await this.run(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
    } catch {
      return "HEAD";
    }
  }

  async getDefaultBranch(): Promise<string> {
    try {
      const ref = (
        await this.run(["symbolic-ref", "refs/remotes/origin/HEAD"])
      ).trim();
      return ref.replace("refs/remotes/origin/", "");
    } catch {
      for (const name of ["main", "master"]) {
        try {
          await this.run(["rev-parse", "--verify", name]);
          return name;
        } catch {
          continue;
        }
      }
      return "main";
    }
  }

  async getMergeBase(a: string, b: string): Promise<string | null> {
    try {
      return (await this.run(["merge-base", a, b])).trim();
    } catch {
      return null;
    }
  }

  async computeDiffRange(): Promise<{ base: string; target: string } | null> {
    const branch = await this.getBranch();
    const defaultBranch = await this.getDefaultBranch();

    if (branch === defaultBranch || branch === "HEAD") {
      return null; // working tree diff against HEAD
    }

    const mergeBase = await this.getMergeBase(defaultBranch, branch);
    if (!mergeBase) return null;

    return { base: mergeBase, target: "HEAD" };
  }

  async getDiff(base?: string, target?: string): Promise<string> {
    const args = ["diff", "--no-color", "-U3"];
    if (base && target) {
      args.push(base, target);
    } else if (base) {
      args.push(base);
    }
    return this.run(args);
  }

  async getStagedDiff(): Promise<string> {
    return this.run(["diff", "--cached", "--no-color", "-U3"]);
  }

  async getChangedFiles(
    base?: string,
    target?: string
  ): Promise<ChangedFile[]> {
    const files: ChangedFile[] = [];

    // Get tracked changes
    const args = ["diff", "--name-status", "--no-color"];
    if (base && target) {
      args.push(base, target);
    } else if (base) {
      args.push(base);
    }
    const output = await this.run(args);
    for (const line of output.trim().split("\n")) {
      if (!line) continue;
      const parsed = this.parseNameStatus(line);
      if (parsed) files.push(parsed);
    }

    // Get line stats
    const numstatArgs = ["diff", "--numstat", "--no-color"];
    if (base && target) {
      numstatArgs.push(base, target);
    } else if (base) {
      numstatArgs.push(base);
    }
    try {
      const numstat = await this.run(numstatArgs);
      for (const line of numstat.trim().split("\n")) {
        if (!line) continue;
        const parts = line.split("\t");
        if (parts.length >= 3) {
          const add = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
          const del = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
          const filePath = parts[2];
          const file = files.find((f) => f.path === filePath);
          if (file) {
            file.additions = add;
            file.deletions = del;
          }
        }
      }
    } catch {
      // ignore
    }

    // Get staged changes
    if (!base && !target) {
      const staged = await this.run([
        "diff",
        "--cached",
        "--name-status",
        "--no-color",
      ]);
      const stagedNumstat = await this.run([
        "diff",
        "--cached",
        "--numstat",
        "--no-color",
      ]).catch(() => "");
      const stagedStats = new Map<string, { add: number; del: number }>();
      for (const line of stagedNumstat.trim().split("\n")) {
        if (!line) continue;
        const parts = line.split("\t");
        if (parts.length >= 3) {
          stagedStats.set(parts[2], {
            add: parts[0] === "-" ? 0 : parseInt(parts[0], 10),
            del: parts[1] === "-" ? 0 : parseInt(parts[1], 10),
          });
        }
      }
      for (const line of staged.trim().split("\n")) {
        if (!line) continue;
        const parsed = this.parseNameStatus(line);
        if (parsed && !files.some((f) => f.path === parsed.path)) {
          const stats = stagedStats.get(parsed.path);
          if (stats) {
            parsed.additions = stats.add;
            parsed.deletions = stats.del;
          }
          files.push(parsed);
        }
      }
    }

    // Get untracked files (only for working tree diff)
    if (!base && !target) {
      try {
        const untracked = await this.run([
          "ls-files",
          "--others",
          "--exclude-standard",
        ]);
        for (const filePath of untracked.trim().split("\n")) {
          if (filePath && !files.some((f) => f.path === filePath)) {
            let additions = 0;
            try {
              const content = await this.getUntrackedFileContent(filePath);
              additions = content.split("\n").length;
            } catch { /* ignore */ }
            files.push({ path: filePath, status: "untracked", additions, deletions: 0 });
          }
        }
      } catch {
        // ignore
      }
    }

    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  async getFileDiff(
    filePath: string,
    base?: string,
    target?: string,
    context = 3
  ): Promise<string> {
    const args = ["diff", "--no-color", `-U${context}`];
    if (base && target) {
      args.push(base, target);
    } else if (base) {
      args.push(base);
    }
    args.push("--", filePath);
    try {
      return await this.run(args);
    } catch {
      return "";
    }
  }

  async getUntrackedFileContent(filePath: string): Promise<string> {
    const resolved = Bun.resolveSync(filePath, this.cwd);
    if (!resolved.startsWith(this.cwd)) {
      throw new Error("Path outside repository");
    }
    const file = Bun.file(resolved);
    return file.text();
  }

  async getUntrackedFileDiff(filePath: string): Promise<string> {
    try {
      const content = await this.getUntrackedFileContent(filePath);
      const lines = content.split("\n");
      const header = [
        `diff --git a/${filePath} b/${filePath}`,
        "new file mode 100644",
        "--- /dev/null",
        `+++ b/${filePath}`,
        `@@ -0,0 +1,${lines.length} @@`,
      ];
      const body = lines.map((l) => `+${l}`);
      return header.join("\n") + "\n" + body.join("\n") + "\n";
    } catch {
      return "";
    }
  }

  async getFullDiff(base?: string, target?: string): Promise<string> {
    let diff = await this.getDiff(base, target);

    if (!base && !target) {
      // Add staged
      const staged = await this.getStagedDiff();
      if (staged) diff = diff + "\n" + staged;

      // Add untracked
      const files = await this.getChangedFiles();
      for (const f of files) {
        if (f.status === "untracked") {
          const ud = await this.getUntrackedFileDiff(f.path);
          if (ud) diff = diff + "\n" + ud;
        }
      }
    }

    return diff;
  }

  async getLogEntries(count = 20): Promise<LogEntry[]> {
    try {
      const output = await this.run([
        "log",
        `--max-count=${count}`,
        "--format=%H\t%s\t%cr",
      ]);
      return output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash, message, date] = line.split("\t");
          return { hash, message, date };
        });
    } catch {
      return [];
    }
  }

  async getBranches(): Promise<{ current: string; branches: string[] }> {
    const current = await this.getBranch();
    try {
      const output = await this.run(["branch", "--format=%(refname:short)"]);
      const branches = output.trim().split("\n").filter(Boolean);
      return { current, branches };
    } catch {
      return { current, branches: [current] };
    }
  }

  async getStatus(): Promise<string> {
    return this.run(["status", "--porcelain"]);
  }

  async getGitDir(): Promise<string> {
    return (await this.run(["rev-parse", "--git-dir"])).trim();
  }

  async getAheadBehind(): Promise<{ ahead: number; behind: number }> {
    try {
      const branch = await this.getBranch();
      if (branch === "HEAD") return { ahead: 0, behind: 0 };
      const output = (
        await this.run([
          "rev-list",
          "--left-right",
          "--count",
          `origin/${branch}...${branch}`,
        ])
      ).trim();
      const [behind, ahead] = output.split("\t").map(Number);
      return { ahead: ahead || 0, behind: behind || 0 };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  async push(): Promise<string> {
    const branch = await this.getBranch();
    return this.run(["push", "origin", branch]);
  }

  async stageAll(): Promise<void> {
    await this.run(["add", "-A"]);
  }

  async stageFiles(paths: string[]): Promise<void> {
    await this.run(["add", "--", ...paths]);
  }

  async commit(message: string): Promise<string> {
    const output = await this.run(["commit", "-m", message]);
    const match = output.match(/\[[\w/.-]+ ([a-f0-9]+)\]/);
    return match?.[1] || "committed";
  }

  async generateCommitMessage(): Promise<string> {
    const files = await this.getChangedFiles();
    if (files.length === 0) return "";

    const diff = await this.getFullDiff();

    // Truncate diff if too large (keep first 8000 chars for LLM context)
    const truncatedDiff =
      diff.length > 8000 ? diff.slice(0, 8000) + "\n... (truncated)" : diff;

    const fileList = files
      .map((f) => {
        const badge =
          f.status === "added" || f.status === "untracked"
            ? "A"
            : f.status === "deleted"
              ? "D"
              : f.status === "renamed"
                ? "R"
                : "M";
        return `${badge} ${f.path}`;
      })
      .join("\n");

    const prompt = `Generate a git commit message for the following changes using the Conventional Commits standard (https://www.conventionalcommits.org).

Rules:
- First line: type(scope): description (max 72 chars, lowercase, imperative mood)
- Types: feat, fix, refactor, style, docs, test, chore, perf, ci, build
- Scope is optional, use the most relevant module/area name
- Add a blank line then a concise body (2-4 bullet points) summarizing the key changes
- Focus on WHY and WHAT changed, not listing every file
- Do NOT wrap in markdown code blocks

Changed files:
${fileList}

Diff:
${truncatedDiff}`;

    try {
      // Find claude binary
      const claudePaths = [
        `${process.env.HOME}/.local/bin/claude`,
        "/usr/local/bin/claude",
        "/Applications/cmux.app/Contents/Resources/bin/claude",
      ];
      let claudeBin: string | null = null;
      for (const p of claudePaths) {
        if (await Bun.file(p).exists()) {
          claudeBin = p;
          break;
        }
      }
      if (!claudeBin) throw new Error("claude not found");

      const proc = Bun.spawn([claudeBin, "-p", prompt], {
        stdout: "pipe",
        stderr: "pipe",
        cwd: this.cwd,
      });
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      if (exitCode === 0 && stdout.trim()) {
        return stdout.trim();
      }
    } catch {
      // claude CLI not available, fall through to fallback
    }

    // Fallback: simple heuristic if claude CLI fails
    return this.generateCommitMessageFallback(files);
  }

  private generateCommitMessageFallback(files: ChangedFile[]): string {
    const paths = files.map((f) => f.path);
    const hasNew = files.some(
      (f) => f.status === "added" || f.status === "untracked"
    );

    let type = hasNew ? "feat" : "refactor";
    const isDocsOnly = paths.every(
      (p) => p.endsWith(".md") || p.includes("docs/")
    );
    const isTestOnly = paths.every(
      (p) => p.includes("test") || p.includes("spec")
    );
    if (isDocsOnly) type = "docs";
    else if (isTestOnly) type = "test";

    const topDirs = [
      ...new Set(
        paths.map((p) => p.split("/")[0]).filter((d) => d && d !== ".")
      ),
    ];
    const scope = topDirs.length === 1 ? `(${topDirs[0]})` : "";

    const desc =
      files.length === 1
        ? `update ${paths[0].split("/").pop()}`
        : `update ${files.length} files`;

    return `${type}${scope}: ${desc}`;
  }

  async summarizeDiff(base?: string, target?: string): Promise<string> {
    const files = await this.getChangedFiles(base, target);
    if (files.length === 0) return "No changes to summarize.";

    const diff = await this.getFullDiff(base, target);
    if (!diff.trim()) return "No changes to summarize.";

    const truncatedDiff =
      diff.length > 8000 ? diff.slice(0, 8000) + "\n... (truncated)" : diff;

    const fileList = files
      .map((f) => {
        const badge =
          f.status === "added" || f.status === "untracked"
            ? "A"
            : f.status === "deleted"
              ? "D"
              : f.status === "renamed"
                ? "R"
                : "M";
        const stats = [];
        if (f.additions) stats.push(`+${f.additions}`);
        if (f.deletions) stats.push(`-${f.deletions}`);
        return `${badge} ${f.path}${stats.length ? ` (${stats.join(", ")})` : ""}`;
      })
      .join("\n");

    const prompt = `Summarize the following code changes in 2-4 concise bullet points. Focus on WHAT changed and WHY it matters. Be specific about the functional impact. Do NOT list files — describe the changes semantically. Keep it brief, no markdown headers, just bullet points starting with •.

Changed files:
${fileList}

Diff:
${truncatedDiff}`;

    try {
      const claudePaths = [
        `${process.env.HOME}/.local/bin/claude`,
        "/usr/local/bin/claude",
        "/Applications/cmux.app/Contents/Resources/bin/claude",
      ];
      let claudeBin: string | null = null;
      for (const p of claudePaths) {
        if (await Bun.file(p).exists()) {
          claudeBin = p;
          break;
        }
      }
      if (!claudeBin) throw new Error("claude not found");

      const proc = Bun.spawn([claudeBin, "-p", prompt], {
        stdout: "pipe",
        stderr: "pipe",
        cwd: this.cwd,
      });
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      if (exitCode === 0 && stdout.trim()) {
        return stdout.trim();
      }
    } catch {
      // fall through
    }

    // Fallback
    const added = files.filter((f) => f.status === "added" || f.status === "untracked").length;
    const modified = files.filter((f) => f.status === "modified").length;
    const deleted = files.filter((f) => f.status === "deleted").length;
    const parts = [];
    if (added) parts.push(`${added} file${added > 1 ? "s" : ""} added`);
    if (modified) parts.push(`${modified} file${modified > 1 ? "s" : ""} modified`);
    if (deleted) parts.push(`${deleted} file${deleted > 1 ? "s" : ""} deleted`);
    return parts.map((p) => `• ${p}`).join("\n");
  }

  private parseNameStatus(line: string): ChangedFile | null {
    const parts = line.split("\t");
    if (parts.length < 2) return null;
    const statusCode = parts[0][0];
    const statusMap: Record<string, ChangedFile["status"]> = {
      A: "added",
      M: "modified",
      D: "deleted",
      R: "renamed",
      C: "copied",
    };
    const status = statusMap[statusCode] || "modified";
    if (status === "renamed" || status === "copied") {
      return { path: parts[2] || parts[1], oldPath: parts[1], status };
    }
    return { path: parts[1], status };
  }
}
