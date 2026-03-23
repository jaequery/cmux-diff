import type { ChangedFile, LogEntry } from "../hooks/useDiff";
import { FileItem } from "./FileItem";
import { CommitItem } from "./CommitItem";
import { CommitSection } from "./CommitSection";

interface Props {
  // View mode
  viewMode: "uncommitted" | "commits";
  // Uncommitted
  uncommittedFiles: ChangedFile[];
  onSwitchToUncommitted: () => void;
  onCommitted: () => void;
  // Log
  logEntries: LogEntry[];
  selectedCommits: Set<string>;
  onSelectCommit: (hash: string) => void;
  onSelectCommitRange: (hash: string) => void;
  hasMoreLogs: boolean;
  onLoadMoreLogs: () => void;
  // Active view files
  files: ChangedFile[];
  selectedFiles: Set<string>;
  activeFile: string | null;
  onToggleFile: (path: string) => void;
  onSelectRange: (path: string) => void;
  onSelectAll: () => void;
  // UI
  branch: string;
  loading: boolean;
  commitMode?: boolean;
}

export function Sidebar({
  viewMode,
  uncommittedFiles,
  onSwitchToUncommitted,
  onCommitted,
  logEntries,
  selectedCommits,
  onSelectCommit,
  onSelectCommitRange,
  hasMoreLogs,
  onLoadMoreLogs,
  files,
  selectedFiles,
  activeFile,
  onToggleFile,
  onSelectRange,
  onSelectAll,
  branch,
  loading,
  commitMode,
}: Props) {
  const allFilesSelected = files.length > 0 && selectedFiles.size === files.length;
  const isUncommittedView = viewMode === "uncommitted";

  return (
    <div className="flex flex-col h-full bg-surface-1 border-r border-border-default overflow-hidden">
      {/* Commit section (hidden in commit history mode) */}
      {!commitMode && (
        <CommitSection hasChanges={uncommittedFiles.length > 0} onCommitted={onCommitted} />
      )}

      {/* Branch */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default shrink-0">
        {branch && (
          <span
            className="text-[10px] text-text-tertiary font-mono truncate"
            title={branch}
          >
            {branch}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-4 text-xs text-text-tertiary">Loading...</div>
        ) : (
          <>
            {/* ── Uncommitted Changes ── */}
            <div className="border-b border-border-default">
              <button
                onClick={onSwitchToUncommitted}
                className={`
                  w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer
                  transition-colors duration-75
                  ${isUncommittedView ? "bg-surface-2" : "hover:bg-surface-2"}
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-primary uppercase tracking-wider">
                    Uncommitted
                  </span>
                  {uncommittedFiles.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-surface-3 text-text-secondary text-[10px] font-medium">
                      {uncommittedFiles.length}
                    </span>
                  )}
                </div>
                {isUncommittedView && files.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
                    className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    {allFilesSelected ? `${selectedFiles.size} selected` : "Select all"}
                  </button>
                )}
              </button>

              {/* Uncommitted file list (always visible when there are files) */}
              {isUncommittedView && uncommittedFiles.length > 0 && (
                <div className="py-0.5">
                  {uncommittedFiles.map((file) => (
                    <FileItem
                      key={file.path}
                      file={file}
                      selected={selectedFiles.has(file.path)}
                      active={activeFile === file.path}
                      onClick={(e) =>
                        e.shiftKey
                          ? onSelectRange(file.path)
                          : onToggleFile(file.path)
                      }
                    />
                  ))}
                </div>
              )}
              {isUncommittedView && uncommittedFiles.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-text-tertiary">
                  No uncommitted changes
                </div>
              )}
            </div>

            {/* ── Commits ── */}
            <div>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default">
                <span className="text-xs font-medium text-text-primary uppercase tracking-wider">
                  Commits
                </span>
                {selectedCommits.size > 1 && (
                  <span className="text-[10px] text-text-tertiary">
                    {selectedCommits.size} selected
                  </span>
                )}
              </div>

              {/* Commit entries */}
              <div className="py-0.5">
                {logEntries.map((entry) => (
                  <CommitItem
                    key={entry.hash}
                    entry={entry}
                    selected={selectedCommits.has(entry.hash)}
                    onClick={(e) =>
                      e.shiftKey
                        ? onSelectCommitRange(entry.hash)
                        : onSelectCommit(entry.hash)
                    }
                  />
                ))}
                {hasMoreLogs && (
                  <button
                    onClick={onLoadMoreLogs}
                    className="w-full px-3 py-2 text-[11px] text-text-tertiary hover:text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    Show more...
                  </button>
                )}
              </div>

              {/* Files for selected commit(s) */}
              {!isUncommittedView && selectedCommits.size > 0 && files.length > 0 && (
                <div className="border-t border-border-default">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-text-primary uppercase tracking-wider">
                        Files
                      </span>
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-surface-3 text-text-secondary text-[10px] font-medium">
                        {files.length}
                      </span>
                    </div>
                    {files.length > 1 && (
                      <button
                        onClick={onSelectAll}
                        className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
                      >
                        {allFilesSelected ? `${selectedFiles.size} selected` : "Select all"}
                      </button>
                    )}
                  </div>
                  <div className="py-0.5">
                    {files.map((file) => (
                      <FileItem
                        key={file.path}
                        file={file}
                        selected={selectedFiles.has(file.path)}
                        active={activeFile === file.path}
                        onClick={(e) =>
                          e.shiftKey
                            ? onSelectRange(file.path)
                            : onToggleFile(file.path)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
