export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "untracked";
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

    // Get staged changes
    if (!base && !target) {
      const staged = await this.run([
        "diff",
        "--cached",
        "--name-status",
        "--no-color",
      ]);
      for (const line of staged.trim().split("\n")) {
        if (!line) continue;
        const parsed = this.parseNameStatus(line);
        if (parsed && !files.some((f) => f.path === parsed.path)) {
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
        for (const path of untracked.trim().split("\n")) {
          if (path && !files.some((f) => f.path === path)) {
            files.push({ path, status: "untracked" });
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
