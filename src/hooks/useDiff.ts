import { useState, useEffect, useCallback, useRef } from "react";

import { apiFetch } from "../lib/api";
import type { DiffFile } from "../lib/diff-parser";
import { parseDiff } from "../lib/diff-parser";

export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: string;
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
}

interface FileDiffData {
  diff: DiffFile | null;
  tokens: { content: string; color?: string }[][] | null;
  context: number;
}

export function useDiff() {
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileDiffs, setFileDiffs] = useState<Map<string, FileDiffData>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);
  const [branch, setBranch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const initialFetchDone = useRef(false);

  // Read commits param from URL (e.g., ?commits=2)
  const commits = new URLSearchParams(window.location.search).get("commits") || undefined;

  const fetchFiles = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (commits) params.commits = commits;
      const data = await apiFetch<{ files: ChangedFile[] }>("/api/diff/files", params);
      setFiles(data.files);
      setError(null);

      // Auto-select all files on initial load
      if (!initialFetchDone.current && data.files.length > 0) {
        initialFetchDone.current = true;
        const allPaths = data.files.map((f) => f.path);
        setSelectedFiles(new Set(allPaths));
        setActiveFile(allPaths[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch files");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFileDiff = useCallback(
    async (filePath: string, context = 3) => {
      setDiffLoading(true);
      try {
        const params: Record<string, string> = {
          path: filePath,
          context: String(context),
        };
        if (commits) params.commits = commits;
        const data = await apiFetch<FileDiffResponse>("/api/diff/file", params);
        let diff: DiffFile | null = null;
        if (data.diff) {
          const parsed = parseDiff(data.diff);
          diff = parsed.files[0] || null;
        }
        setFileDiffs((prev) => {
          const next = new Map(prev);
          next.set(filePath, {
            diff,
            tokens: data.tokens || null,
            context,
          });
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

  const expandContext = useCallback(
    (filePath: string) => {
      const current = fileDiffs.get(filePath)?.context || 3;
      const newContext = current + 20;
      fetchFileDiff(filePath, newContext);
    },
    [fileDiffs, fetchFileDiff]
  );

  const fetchMultipleDiffs = useCallback(
    async (paths: string[]) => {
      setDiffLoading(true);
      await Promise.all(paths.map((p) => fetchFileDiff(p)));
      setDiffLoading(false);
    },
    [fetchFileDiff]
  );

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch<StatusResponse>("/api/status");
      setBranch(data.branch);
    } catch {
      // ignore
    }
  }, []);

  const lastClickedRef = useRef<string | null>(null);

  // Select only this file (plain click — deselects all others)
  const toggleFile = useCallback(
    (path: string) => {
      lastClickedRef.current = path;
      setSelectedFiles(new Set([path]));
      setActiveFile(path);
      if (!fileDiffs.has(path)) {
        fetchFileDiff(path);
      }
    },
    [fileDiffs, fetchFileDiff]
  );

  // Select a range of files (shift+click)
  const selectRange = useCallback(
    (path: string) => {
      const anchor = lastClickedRef.current;
      if (!anchor) {
        // No previous click — just toggle
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
          if (!fileDiffs.has(files[i].path)) {
            fetchFileDiff(files[i].path);
          }
        }
        return next;
      });
      setActiveFile(path);
    },
    [files, fileDiffs, fetchFileDiff, toggleFile]
  );

  // Navigate to a file (keyboard nav — selects only this file)
  const navigateFile = useCallback(
    (path: string) => {
      setSelectedFiles(new Set([path]));
      setActiveFile(path);
      if (!fileDiffs.has(path)) {
        fetchFileDiff(path);
      }
    },
    [fileDiffs, fetchFileDiff]
  );

  // Select all files
  const selectAll = useCallback(() => {
    const allPaths = files.map((f) => f.path);
    setSelectedFiles(new Set(allPaths));
    setActiveFile(allPaths[0] || null);
    const unfetched = allPaths.filter((p) => !fileDiffs.has(p));
    if (unfetched.length > 0) {
      fetchMultipleDiffs(unfetched);
    }
  }, [files, fileDiffs, fetchMultipleDiffs]);

  // Initial load
  useEffect(() => {
    fetchFiles();
    fetchStatus();
  }, [fetchFiles, fetchStatus]);

  // Fetch diff when active file changes and we don't have it cached
  useEffect(() => {
    if (activeFile && !fileDiffs.has(activeFile)) {
      fetchFileDiff(activeFile);
    }
  }, [activeFile, fileDiffs, fetchFileDiff]);

  // Listen for WebSocket updates
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data?.type === "diff-updated") {
        fetchFiles();
        // Refetch diffs for all selected files
        setFileDiffs(new Map()); // clear cache
        fetchStatus();
      }
    };

    window.addEventListener("ws-message", handler);
    return () => window.removeEventListener("ws-message", handler);
  }, [fetchFiles, fetchStatus]);

  // After cache is cleared by ws update, refetch selected files
  useEffect(() => {
    if (fileDiffs.size === 0 && selectedFiles.size > 0) {
      for (const path of selectedFiles) {
        fetchFileDiff(path);
      }
    }
  }, [fileDiffs, selectedFiles, fetchFileDiff]);

  // Get ordered diffs for display
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
    error,
    expandContext,
    refresh: fetchFiles,
    commitMode: !!commits,
  };
}
