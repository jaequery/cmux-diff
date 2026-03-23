import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { DiffPane } from "./components/DiffPane";
import { useWebSocket } from "./hooks/useWebSocket";
import { useDiff } from "./hooks/useDiff";

export function App() {
  const {
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
    refresh,
  } = useDiff();

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
        const idx = files.findIndex((f) => f.path === activeFile);
        if (idx > 0) navigateFile(files[idx - 1].path);
      } else if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const idx = files.findIndex((f) => f.path === activeFile);
        if (idx < files.length - 1) navigateFile(files[idx + 1].path);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [files, activeFile, navigateFile, selectAll]);

  return (
    <div
      className={`flex h-screen bg-surface-0 overflow-hidden ${resizing ? "select-none cursor-col-resize" : ""}`}
    >
      {/* Sidebar */}
      <div style={{ width: sidebarWidth }} className="shrink-0">
        <Sidebar
          files={files}
          selectedFiles={selectedFiles}
          activeFile={activeFile}
          onToggleFile={toggleFile}
          onSelectRange={selectRange}
          onSelectAll={selectAll}
          onCommitted={refresh}
          branch={branch}
          loading={loading}
        />
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="w-[3px] shrink-0 cursor-col-resize hover:bg-border-accent transition-colors duration-150"
      />

      {/* Diff pane */}
      <div className="flex-1 min-w-0">
        <DiffPane
          selectedDiffs={selectedDiffs}
          activeFile={activeFile}
          loading={diffLoading}
          noChanges={!loading && files.length === 0}
          onExpandContext={expandContext}
        />
      </div>
    </div>
  );
}
