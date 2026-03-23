import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../lib/api";
import type { DiffFile } from "../lib/diff-parser";
import { parseDiff } from "../lib/diff-parser";
import type { ChangedFile } from "./useDiff";

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

interface FileDiffData {
  diff: DiffFile | null;
  tokens: { content: string; color?: string }[][] | null;
  context: number;
}

export function useLogMode() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [selectedCommits, setSelectedCommits] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileDiffs, setFileDiffs] = useState<Map<string, FileDiffData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);
  const [branch, setBranch] = useState("");
  const [logCount, setLogCount] = useState(5);
  const [hasMore, setHasMore] = useState(true);
  const lastClickedRef = useRef<string | null>(null);
  const lastClickedCommitRef = useRef<string | null>(null);
  // Track current diff range to use in file operations
  const diffRangeRef = useRef<{ base: string; target: string } | null>(null);

  const fetchLog = useCallback(async (count = 5) => {
    try {
      const data = await apiFetch<{ entries: LogEntry[] }>("/api/log", { count: String(count) });
      setEntries(data.entries);
      setHasMore(data.entries.length >= count);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    const newCount = logCount + 5;
    setLogCount(newCount);
    fetchLog(newCount);
  }, [logCount, fetchLog]);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch<{ branch: string }>("/api/status");
      setBranch(data.branch);
    } catch {
      // ignore
    }
  }, []);

  const fetchFileDiff = useCallback(
    async (filePath: string, base: string, target: string, context = 3) => {
      setDiffLoading(true);
      try {
        const data = await apiFetch<FileDiffResponse>("/api/diff/file", {
          path: filePath,
          base,
          target,
          context: String(context),
        });
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
    []
  );

  // Compute diff range from selected commits (oldest parent to newest)
  const computeRange = useCallback(
    (hashes: Set<string>): { base: string; target: string } | null => {
      if (hashes.size === 0) return null;
      // Find the indices in entries (entries are newest-first)
      const indices = Array.from(hashes)
        .map((h) => entries.findIndex((e) => e.hash === h))
        .filter((i) => i !== -1)
        .sort((a, b) => a - b);
      if (indices.length === 0) return null;
      const newestIdx = indices[0]; // smallest index = newest
      const oldestIdx = indices[indices.length - 1]; // largest index = oldest
      const newest = entries[newestIdx].hash;
      const oldest = entries[oldestIdx].hash;
      return { base: `${oldest}~1`, target: newest };
    },
    [entries]
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
        await Promise.all(allPaths.map((p) => fetchFileDiff(p, base, target)));
      } catch {
        setFiles([]);
      }
    },
    [fetchFileDiff]
  );

  // Plain click: select only this commit
  const selectCommit = useCallback(
    async (hash: string) => {
      lastClickedCommitRef.current = hash;
      const newSelected = new Set([hash]);
      setSelectedCommits(newSelected);
      const range = computeRange(newSelected);
      if (range) await loadDiffsForRange(range.base, range.target);
    },
    [computeRange, loadDiffsForRange]
  );

  // Shift+click: select range of commits
  const selectCommitRange = useCallback(
    async (hash: string) => {
      const anchor = lastClickedCommitRef.current;
      if (!anchor) {
        await selectCommit(hash);
        return;
      }
      const anchorIdx = entries.findIndex((e) => e.hash === anchor);
      const targetIdx = entries.findIndex((e) => e.hash === hash);
      if (anchorIdx === -1 || targetIdx === -1) {
        await selectCommit(hash);
        return;
      }
      const start = Math.min(anchorIdx, targetIdx);
      const end = Math.max(anchorIdx, targetIdx);
      const newSelected = new Set<string>();
      for (let i = start; i <= end; i++) {
        newSelected.add(entries[i].hash);
      }
      setSelectedCommits(newSelected);
      const range = computeRange(newSelected);
      if (range) await loadDiffsForRange(range.base, range.target);
    },
    [entries, computeRange, loadDiffsForRange, selectCommit]
  );

  const toggleFile = useCallback(
    (path: string) => {
      lastClickedRef.current = path;
      setSelectedFiles(new Set([path]));
      setActiveFile(path);
      if (!fileDiffs.has(path) && diffRangeRef.current) {
        fetchFileDiff(path, diffRangeRef.current.base, diffRangeRef.current.target);
      }
    },
    [fileDiffs, fetchFileDiff]
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
        for (let i = start; i <= end; i++) {
          next.add(files[i].path);
          if (!fileDiffs.has(files[i].path) && diffRangeRef.current) {
            fetchFileDiff(files[i].path, diffRangeRef.current.base, diffRangeRef.current.target);
          }
        }
        return next;
      });
      setActiveFile(path);
    },
    [files, fileDiffs, fetchFileDiff, toggleFile]
  );

  const navigateFile = useCallback(
    (path: string) => {
      setSelectedFiles(new Set([path]));
      setActiveFile(path);
      if (!fileDiffs.has(path) && diffRangeRef.current) {
        fetchFileDiff(path, diffRangeRef.current.base, diffRangeRef.current.target);
      }
    },
    [fileDiffs, fetchFileDiff]
  );

  const selectAll = useCallback(() => {
    const allPaths = files.map((f) => f.path);
    setSelectedFiles(new Set(allPaths));
    setActiveFile(allPaths[0] || null);
    if (diffRangeRef.current) {
      const { base, target } = diffRangeRef.current;
      const unfetched = allPaths.filter((p) => !fileDiffs.has(p));
      Promise.all(unfetched.map((p) => fetchFileDiff(p, base, target)));
    }
  }, [files, fileDiffs, fetchFileDiff]);

  const expandContext = useCallback(
    (filePath: string) => {
      if (!diffRangeRef.current) return;
      const current = fileDiffs.get(filePath)?.context || 3;
      fetchFileDiff(filePath, diffRangeRef.current.base, diffRangeRef.current.target, current + 20);
    },
    [fileDiffs, fetchFileDiff]
  );

  const isLogMode = new URLSearchParams(window.location.search).get("mode") === "log";

  useEffect(() => {
    if (!isLogMode) return;
    fetchLog(logCount);
    fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStatus, isLogMode]);

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

  return {
    entries,
    selectedCommits,
    selectCommit,
    selectCommitRange,
    files,
    selectedFiles,
    activeFile,
    toggleFile,
    selectRange,
    navigateFile,
    selectAll,
    selectedDiffs,
    loading,
    diffLoading,
    branch,
    expandContext,
    loadMore,
    hasMore,
  };
}
