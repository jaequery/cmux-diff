import { watch, type FSWatcher } from "fs";
import path from "path";

type WatcherCallback = () => void;

export class FileWatcher {
  private watchers: FSWatcher[] = [];
  private listeners: WatcherCallback[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs = 300;

  constructor(
    private cwd: string,
    private gitDir?: string
  ) {}

  async start() {
    // Watch working tree
    try {
      const { existsSync } = await import("fs");
      if (!existsSync(this.cwd)) {
        console.error(`Warning: directory does not exist: ${this.cwd}`);
        return;
      }
      const watcher = watch(
        this.cwd,
        { recursive: true },
        (_event, filename) => {
          if (!filename) return;
          if (this.shouldIgnore(filename)) return;
          this.scheduleNotify();
        }
      );
      this.watchers.push(watcher);
    } catch (e) {
      console.error("Failed to watch working tree:", e);
    }

    // Watch git dir for ref changes
    if (this.gitDir) {
      const refsDir = path.join(this.gitDir, "refs");
      try {
        const watcher = watch(refsDir, { recursive: true }, () => {
          this.scheduleNotify();
        });
        this.watchers.push(watcher);
      } catch {
        // refs dir may not exist yet
      }

      // Watch HEAD for branch switches
      try {
        const watcher = watch(this.gitDir, (_event, filename) => {
          if (filename === "HEAD" || filename === "index") {
            this.scheduleNotify();
          }
        });
        this.watchers.push(watcher);
      } catch {
        // ignore
      }
    }
  }

  onChanged(cb: WatcherCallback) {
    this.listeners.push(cb);
  }

  stop() {
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  private shouldIgnore(filename: string): boolean {
    if (filename.startsWith(".git/") || filename.startsWith(".git\\"))
      return true;
    if (filename.startsWith(".dist/") || filename.startsWith(".dist\\"))
      return true;
    if (filename.startsWith("dist/") || filename.startsWith("dist\\"))
      return true;
    if (filename.includes("node_modules")) return true;
    if (filename.includes(".DS_Store")) return true;
    return false;
  }

  private scheduleNotify() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      for (const cb of this.listeners) {
        cb();
      }
    }, this.debounceMs);
  }
}
