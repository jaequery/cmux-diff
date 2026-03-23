import { useState, useEffect, useCallback, useRef } from "react";

import { apiFetch } from "../lib/api";
import type { DiffFile } from "../lib/diff-parser";
import { parseDiff } from "../lib/diff-parser";

export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: string;
}

export interface LogEntry {
  hash: string;
  message: string;
  date: string;
}

interface FileDiffResponse {
  path: string;
  oldPath?: string;
  status: string;
  diff: string;
  tokens?: { content: string; color?: string }[][];
}

interface StatusResponse {
  branch: string;
  cwd: string;
  ahead: number;
  behind: number;
}

interface FileDiffData {
  diff: DiffFile | null;
  tokens: { content: string; color?: string }[][] | null;
  context: number;
}

type ViewMode = "uncommitted" | "commits";

export function useDiff() {
  // --- Uncommitted state ---
  const [uncommittedFiles, setUncommittedFiles] = useState<ChangedFile[]>([]);

  // --- Log state ---
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logCount, setLogCount] = useState(5);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [selectedCommits, setSelectedCommits] = useState<Set<string>>(new Set());
  const lastClickedCommitRef = useRef<string | null>(null);

  // --- Shared state ---
  const [viewMode, setViewMode] = useState<ViewMode>("uncommitted");
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileDiffs, setFileDiffs] = useState<Map<string, FileDiffData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);
  const [branch, setBranch] = useState("");
  const [ahead, setAhead] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const initialFetchDone = useRef(false);
  const lastClickedRef = useRef<string | null>(null);
  const diffRangeRef = useRef<{ base: string; target: string } | null>(null);

  // Read commits param from URL (e.g., ?commits=2)
  const commits = new URLSearchParams(window.location.search).get("commits") || undefined;

  // ==================== Fetching ====================

  const fetchUncommittedFiles = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (commits) params.commits = commits;
      const data = await apiFetch<{ files: ChangedFile[] }>("/api/diff/files", params);
      setUncommittedFiles(data.files);
      setError(null);

      // Auto-select all uncommitted files on initial load
      if (!initialFetchDone.current && data.files.length > 0) {
        initialFetchDone.current = true;
        setFiles(data.files);
        const allPaths = data.files.map((f) => f.path);
        setSelectedFiles(new Set(allPaths));
        setActiveFile(allPaths[0]);
      } else if (viewMode === "uncommitted") {
        setFiles(data.files);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch files");
    } finally {
      setLoading(false);
    }
  }, [commits, viewMode]);

  const fetchLog = useCallback(async (count = 5) => {
    try {
      const data = await apiFetch<{ entries: LogEntry[] }>("/api/log", { count: String(count) });
      setLogEntries(data.entries);
      setHasMoreLogs(data.entries.length >= count);
    } catch {
      // ignore
    }
  }, []);

  const loadMoreLogs = useCallback(() => {
    const newCount = logCount + 5;
    setLogCount(newCount);
    fetchLog(newCount);
  }, [logCount, fetchLog]);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch<StatusResponse>("/api/status");
      setBranch(data.branch);
      setAhead(data.ahead || 0);
    } catch {
      // ignore
    }
  }, []);

  const fetchFileDiffWithRange = useCallback(
    async (filePath: string, base?: string, target?: string, context = 3) => {
      setDiffLoading(true);
      try {
        const params: Record<string, string> = {
          path: filePath,
          context: String(context),
        };
        if (base && target) {
          params.base = base;
          params.target = target;
        } else if (commits) {
          params.commits = commits;
        }
        const data = await apiFetch<FileDiffResponse>("/api/diff/file", params);
        let diff: DiffFile | null = null;
        if (data.diff) {
          const parsed = parseDiff(data.diff);
          diff = parsed.files[0] || null;
        }
        setFileDiffs((prev) => {
          const next = new Map(prev);
          next.set(filePath, { diff, tokens: data.tokens || null, context });
          return next;
        });
      } catch {
        setFileDiffs((prev) => {
          const next = new Map(prev);
          next.set(filePath, { diff: null, tokens: null, context });
          return next;
        });
      } finally {
        setDiffLoading(false);
      }
    },
    [commits]
  );

  // ==================== View switching ====================

  const switchToUncommitted = useCallback(() => {
    setViewMode("uncommitted");
    setSelectedCommits(new Set());
    diffRangeRef.current = null;
    setFiles(uncommittedFiles);
    setFileDiffs(new Map());
    // Select all uncommitted files
    const allPaths = uncommittedFiles.map((f) => f.path);
    setSelectedFiles(new Set(allPaths));
    setActiveFile(allPaths[0] || null);
  }, [uncommittedFiles]);

  // Compute diff range from selected commits
  const computeRange = useCallback(
    (hashes: Set<string>): { base: string; target: string } | null => {
      if (hashes.size === 0) return null;
      const indices = Array.from(hashes)
        .map((h) => logEntries.findIndex((e) => e.hash === h))
        .filter((i) => i !== -1)
        .sort((a, b) => a - b);
      if (indices.length === 0) return null;
      const newestIdx = indices[0];
      const oldestIdx = indices[indices.length - 1];
      return { base: `${logEntries[oldestIdx].hash}~1`, target: logEntries[newestIdx].hash };
    },
    [logEntries]
  );

  const loadDiffsForRange = useCallback(
    async (base: string, target: string) => {
      diffRangeRef.current = { base, target };
      setFileDiffs(new Map());
      setSelectedFiles(new Set());
      setActiveFile(null);

      try {
        const data = await apiFetch<{ files: ChangedFile[] }>("/api/diff/files", { base, target });
        setFiles(data.files);
        const allPaths = data.files.map((f) => f.path);
        setSelectedFiles(new Set(allPaths));
        if (allPaths.length > 0) setActiveFile(allPaths[0]);
        await Promise.all(allPaths.map((p) => fetchFileDiffWithRange(p, base, target)));
      } catch {
        setFiles([]);
      }
    },
    [fetchFileDiffWithRange]
  );

  // Plain click on a commit
  const selectCommit = useCallback(
    async (hash: string) => {
      lastClickedCommitRef.current = hash;
      setViewMode("commits");
      const newSelected = new Set([hash]);
      setSelectedCommits(newSelected);
      const range = computeRange(newSelected);
      if (range) await loadDiffsForRange(range.base, range.target);
    },
    [computeRange, loadDiffsForRange]
  );

  // Shift+click on a commit
  const selectCommitRange = useCallback(
    async (hash: string) => {
      const anchor = lastClickedCommitRef.current;
      if (!anchor) {
        await selectCommit(hash);
        return;
      }
      const anchorIdx = logEntries.findIndex((e) => e.hash === anchor);
      const targetIdx = logEntries.findIndex((e) => e.hash === hash);
      if (anchorIdx === -1 || targetIdx === -1) {
        await selectCommit(hash);
        return;
      }
      const start = Math.min(anchorIdx, targetIdx);
      const end = Math.max(anchorIdx, targetIdx);
      const newSelected = new Set<string>();
      for (let i = start; i <= end; i++) {
        newSelected.add(logEntries[i].hash);
      }
      setViewMode("commits");
      setSelectedCommits(newSelected);
      const range = computeRange(newSelected);
      if (range) await loadDiffsForRange(range.base, range.target);
    },
    [logEntries, computeRange, loadDiffsForRange, selectCommit]
  );

  // ==================== File selection ====================

  const toggleFile = useCallback(
    (path: string) => {
      lastClickedRef.current = path;
      setSelectedFiles(new Set([path]));
      setActiveFile(path);
      if (!fileDiffs.has(path)) {
        const range = diffRangeRef.current;
        fetchFileDiffWithRange(path, range?.base, range?.target);
      }
    },
    [fileDiffs, fetchFileDiffWithRange]
  );

  const selectRange = useCallback(
    (path: string) => {
      const anchor = lastClickedRef.current;
      if (!anchor) {
        toggleFile(path);
        return;
      }
      const anchorIdx = files.findIndex((f) => f.path === anchor);
      const targetIdx = files.findIndex((f) => f.path === path);
      if (anchorIdx === -1 || targetIdx === -1) {
        toggleFile(path);
        return;
      }
      const start = Math.min(anchorIdx, targetIdx);
      const end = Math.max(anchorIdx, targetIdx);
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        const range = diffRangeRef.current;
        for (let i = start; i <= end; i++) {
          next.add(files[i].path);
          if (!fileDiffs.has(files[i].path)) {
            fetchFileDiffWithRange(files[i].path, range?.base, range?.target);
          }
        }
        return next;
      });
      setActiveFile(path);
    },
    [files, fileDiffs, fetchFileDiffWithRange, toggleFile]
  );

  const navigateFile = useCallback(
    (path: string) => {
      setSelectedFiles(new Set([path]));
      setActiveFile(path);
      if (!fileDiffs.has(path)) {
        const range = diffRangeRef.current;
        fetchFileDiffWithRange(path, range?.base, range?.target);
      }
    },
    [fileDiffs, fetchFileDiffWithRange]
  );

  const selectAll = useCallback(() => {
    const allPaths = files.map((f) => f.path);
    setSelectedFiles(new Set(allPaths));
    setActiveFile(allPaths[0] || null);
    const range = diffRangeRef.current;
    const unfetched = allPaths.filter((p) => !fileDiffs.has(p));
    if (unfetched.length > 0) {
      Promise.all(unfetched.map((p) => fetchFileDiffWithRange(p, range?.base, range?.target)));
    }
  }, [files, fileDiffs, fetchFileDiffWithRange]);

  const expandContext = useCallback(
    (filePath: string) => {
      const current = fileDiffs.get(filePath)?.context || 3;
      const range = diffRangeRef.current;
      fetchFileDiffWithRange(filePath, range?.base, range?.target, current + 20);
    },
    [fileDiffs, fetchFileDiffWithRange]
  );

  // ==================== Effects ====================

  // Initial load
  useEffect(() => {
    fetchUncommittedFiles();
    fetchLog(logCount);
    fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch diff when active file changes and we don't have it cached
  useEffect(() => {
    if (activeFile && !fileDiffs.has(activeFile)) {
      const range = diffRangeRef.current;
      fetchFileDiffWithRange(activeFile, range?.base, range?.target);
    }
  }, [activeFile, fileDiffs, fetchFileDiffWithRange]);

  // Listen for WebSocket updates
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.type === "diff-updated") {
        fetchUncommittedFiles();
        fetchLog(logCount);
        fetchStatus();
        if (viewMode === "uncommitted") {
          setFileDiffs(new Map());
        }
      }
    };

    window.addEventListener("ws-message", handler);
    return () => window.removeEventListener("ws-message", handler);
  }, [fetchUncommittedFiles, fetchStatus, fetchLog, logCount, viewMode]);

  // After cache is cleared by ws update, refetch selected files (uncommitted mode only)
  useEffect(() => {
    if (viewMode === "uncommitted" && fileDiffs.size === 0 && selectedFiles.size > 0) {
      for (const path of selectedFiles) {
        fetchFileDiffWithRange(path);
      }
    }
  }, [fileDiffs, selectedFiles, fetchFileDiffWithRange, viewMode]);

  // ==================== Derived ====================

  const selectedDiffs = Array.from(selectedFiles)
    .sort((a, b) => {
      const ai = files.findIndex((f) => f.path === a);
      const bi = files.findIndex((f) => f.path === b);
      return ai - bi;
    })
    .map((path) => ({
      path,
      fileInfo: files.find((f) => f.path === path),
      ...fileDiffs.get(path),
    }));

  // Commit info for display
  const commitInfo = viewMode === "commits" && selectedCommits.size > 0
    ? (() => {
        const selected = logEntries.filter((e) => selectedCommits.has(e.hash));
        if (selected.length === 0) return null;
        if (selected.length === 1) return selected[0];
        const newest = selected[0];
        const oldest = selected[selected.length - 1];
        return {
          hash: `${oldest.hash.slice(0, 7)}..${newest.hash.slice(0, 7)}`,
          message: selected.map((e) => `• ${e.message}`).join("\n"),
          date: `${oldest.date} — ${newest.date}`,
        };
      })()
    : null;

  return {
    // View mode
    viewMode,
    // Uncommitted
    uncommittedFiles,
    // Log
    logEntries,
    selectedCommits,
    selectCommit,
    selectCommitRange,
    switchToUncommitted,
    loadMoreLogs,
    hasMoreLogs,
    // Active view files
    files,
    selectedFiles,
    activeFile,
    toggleFile,
    selectRange,
    navigateFile,
    selectAll,
    selectedDiffs,
    // UI state
    loading,
    diffLoading,
    branch,
    ahead,
    error,
    expandContext,
    commitInfo,
    refresh: fetchUncommittedFiles,
    commitMode: !!commits,
  };
}
