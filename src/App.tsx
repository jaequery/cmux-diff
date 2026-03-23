import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { LogSidebar } from "./components/LogSidebar";
import { DiffPane } from "./components/DiffPane";
import { useWebSocket } from "./hooks/useWebSocket";
import { useDiff } from "./hooks/useDiff";
import { useLogMode } from "./hooks/useLogMode";

const isLogMode =
  new URLSearchParams(window.location.search).get("mode") === "log";

function AppContent() {
  const diff = useDiff();
  const log = useLogMode();

  // Use log mode state when in log mode, otherwise use diff state
  const state = isLogMode
    ? {
        files: log.files,
        selectedFiles: log.selectedFiles,
        activeFile: log.activeFile,
        toggleFile: log.toggleFile,
        selectRange: log.selectRange,
        navigateFile: log.navigateFile,
        selectAll: log.selectAll,
        selectedDiffs: log.selectedDiffs,
        loading: log.loading,
        diffLoading: log.diffLoading,
        branch: log.branch,
        expandContext: log.expandContext,
      }
    : {
        files: diff.files,
        selectedFiles: diff.selectedFiles,
        activeFile: diff.activeFile,
        toggleFile: diff.toggleFile,
        selectRange: diff.selectRange,
        navigateFile: diff.navigateFile,
        selectAll: diff.selectAll,
        selectedDiffs: diff.selectedDiffs,
        loading: diff.loading,
        diffLoading: diff.diffLoading,
        branch: diff.branch,
        expandContext: diff.expandContext,
      };

  useWebSocket();

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("cmux-diff-sidebar-width");
    return saved ? parseInt(saved, 10) : 280;
  });
  const [resizing, setResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const width = Math.max(180, Math.min(450, e.clientX));
      setSidebarWidth(width);
    };

    const handleMouseUp = () => {
      setResizing(false);
      localStorage.setItem("cmux-diff-sidebar-width", String(sidebarWidth));
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing, sidebarWidth]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const idx = state.files.findIndex((f) => f.path === state.activeFile);
        if (idx > 0) state.navigateFile(state.files[idx - 1].path);
      } else if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const idx = state.files.findIndex((f) => f.path === state.activeFile);
        if (idx < state.files.length - 1)
          state.navigateFile(state.files[idx + 1].path);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        state.selectAll();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.files, state.activeFile, state.navigateFile, state.selectAll]);

  return (
    <div
      className={`flex h-screen bg-surface-0 overflow-hidden ${resizing ? "select-none cursor-col-resize" : ""}`}
    >
      {/* Sidebar */}
      <div style={{ width: sidebarWidth }} className="shrink-0">
        {isLogMode ? (
          <LogSidebar
            entries={log.entries}
            selectedCommit={log.selectedCommit}
            onSelectCommit={log.selectCommit}
            files={state.files}
            selectedFiles={state.selectedFiles}
            activeFile={state.activeFile}
            onToggleFile={state.toggleFile}
            onSelectRange={state.selectRange}
            onSelectAll={state.selectAll}
            branch={state.branch}
            loading={state.loading}
            hasMore={log.hasMore}
            onLoadMore={log.loadMore}
          />
        ) : (
          <Sidebar
            files={state.files}
            selectedFiles={state.selectedFiles}
            activeFile={state.activeFile}
            onToggleFile={state.toggleFile}
            onSelectRange={state.selectRange}
            onSelectAll={state.selectAll}
            onCommitted={diff.refresh}
            branch={state.branch}
            loading={state.loading}
            commitMode={diff.commitMode}
          />
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="w-[3px] shrink-0 cursor-col-resize hover:bg-border-accent transition-colors duration-150"
      />

      {/* Diff pane */}
      <div className="flex-1 min-w-0">
        <DiffPane
          selectedDiffs={state.selectedDiffs}
          activeFile={state.activeFile}
          loading={state.diffLoading}
          noChanges={
            isLogMode
              ? !state.loading && log.selectedCommit !== null && state.files.length === 0
              : !state.loading && state.files.length === 0
          }
          onExpandContext={state.expandContext}
          emptyMessage={
            isLogMode && !log.selectedCommit
              ? "Select a commit to view changes"
              : undefined
          }
          commitInfo={
            isLogMode && log.selectedCommit
              ? log.entries.find((e) => e.hash === log.selectedCommit) || null
              : null
          }
        />
      </div>
    </div>
  );
}

export function App() {
  return <AppContent />;
}
