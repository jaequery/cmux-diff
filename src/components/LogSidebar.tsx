import type { LogEntry } from "../hooks/useLogMode";
import type { ChangedFile } from "../hooks/useDiff";
import { CommitItem } from "./CommitItem";
import { FileItem } from "./FileItem";

interface Props {
  entries: LogEntry[];
  selectedCommits: Set<string>;
  onSelectCommit: (hash: string) => void;
  onSelectCommitRange: (hash: string) => void;
  files: ChangedFile[];
  selectedFiles: Set<string>;
  activeFile: string | null;
  onToggleFile: (path: string) => void;
  onSelectRange: (path: string) => void;
  onSelectAll: () => void;
  branch: string;
  loading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function LogSidebar({
  entries,
  selectedCommits,
  onSelectCommit,
  onSelectCommitRange,
  files,
  selectedFiles,
  activeFile,
  onToggleFile,
  onSelectRange,
  onSelectAll,
  branch,
  loading,
  hasMore,
  onLoadMore,
}: Props) {
  const allSelected = files.length > 0 && selectedFiles.size === files.length;
  const hasSelection = selectedCommits.size > 0;

  return (
    <div className="flex flex-col h-full bg-surface-1 border-r border-border-default overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-primary uppercase tracking-wider">
            Commits
          </span>
          {entries.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-surface-3 text-text-secondary text-[10px] font-medium">
              {entries.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedCommits.size > 1 && (
            <span className="text-[10px] text-text-tertiary">
              {selectedCommits.size} selected
            </span>
          )}
          {branch && (
            <span
              className="text-[10px] text-text-tertiary font-mono truncate max-w-[80px]"
              title={branch}
            >
              {branch}
            </span>
          )}
        </div>
      </div>

      {/* Commit list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-4 text-xs text-text-tertiary">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="px-3 py-4 text-xs text-text-tertiary">No commits</div>
        ) : (
          <>
            {/* Commits */}
            <div className="py-1 border-b border-border-default">
              {entries.map((entry) => (
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
              {hasMore && onLoadMore && (
                <button
                  onClick={onLoadMore}
                  className="w-full px-3 py-2 text-[11px] text-text-tertiary hover:text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  Show more...
                </button>
              )}
            </div>

            {/* Files for selected commit(s) */}
            {hasSelection && files.length > 0 && (
              <div>
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
                      {allSelected ? `${selectedFiles.size} selected` : "Select all"}
                    </button>
                  )}
                </div>
                <div className="py-1">
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
          </>
        )}
      </div>
    </div>
  );
}
