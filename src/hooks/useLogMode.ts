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
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
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

  const selectCommit = useCallback(
    async (hash: string) => {
      setSelectedCommit(hash);
      setFileDiffs(new Map());
      setSelectedFiles(new Set());
      setActiveFile(null);

      const base = `${hash}~1`;
      const target = hash;

      try {
        const data = await apiFetch<{ files: ChangedFile[] }>("/api/diff/files", { base, target });
        setFiles(data.files);
        // Select all files by default
        const allPaths = data.files.map((f) => f.path);
        setSelectedFiles(new Set(allPaths));
        if (allPaths.length > 0) setActiveFile(allPaths[0]);
        // Fetch all diffs
        await Promise.all(allPaths.map((p) => fetchFileDiff(p, base, target)));
      } catch {
        setFiles([]);
      }
    },
    [fetchFileDiff]
  );

  const toggleFile = useCallback(
    (path: string) => {
      lastClickedRef.current = path;
      setSelectedFiles(new Set([path]));
      setActiveFile(path);
      if (!fileDiffs.has(path) && selectedCommit) {
        fetchFileDiff(path, `${selectedCommit}~1`, selectedCommit);
      }
    },
    [fileDiffs, fetchFileDiff, selectedCommit]
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
          if (!fileDiffs.has(files[i].path) && selectedCommit) {
            fetchFileDiff(files[i].path, `${selectedCommit}~1`, selectedCommit);
          }
        }
        return next;
      });
      setActiveFile(path);
    },
    [files, fileDiffs, fetchFileDiff, selectedCommit, toggleFile]
  );

  const navigateFile = useCallback(
    (path: string) => {
      setSelectedFiles(new Set([path]));
      setActiveFile(path);
      if (!fileDiffs.has(path) && selectedCommit) {
        fetchFileDiff(path, `${selectedCommit}~1`, selectedCommit);
      }
    },
    [fileDiffs, fetchFileDiff, selectedCommit]
  );

  const selectAll = useCallback(() => {
    const allPaths = files.map((f) => f.path);
    setSelectedFiles(new Set(allPaths));
    setActiveFile(allPaths[0] || null);
    if (selectedCommit) {
      const unfetched = allPaths.filter((p) => !fileDiffs.has(p));
      Promise.all(unfetched.map((p) => fetchFileDiff(p, `${selectedCommit}~1`, selectedCommit)));
    }
  }, [files, fileDiffs, fetchFileDiff, selectedCommit]);

  const expandContext = useCallback(
    (filePath: string) => {
      if (!selectedCommit) return;
      const current = fileDiffs.get(filePath)?.context || 3;
      fetchFileDiff(filePath, `${selectedCommit}~1`, selectedCommit, current + 20);
    },
    [fileDiffs, fetchFileDiff, selectedCommit]
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
    selectedCommit,
    selectCommit,
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
