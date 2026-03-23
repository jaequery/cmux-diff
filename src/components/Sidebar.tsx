import type { ChangedFile } from "../hooks/useDiff";
import { FileItem } from "./FileItem";
import { CommitSection } from "./CommitSection";

interface Props {
  files: ChangedFile[];
  selectedFiles: Set<string>;
  activeFile: string | null;
  onToggleFile: (path: string) => void;
  onSelectRange: (path: string) => void;
  onSelectAll: () => void;
  onCommitted: () => void;
  branch: string;
  loading: boolean;
}

export function Sidebar({
  files,
  selectedFiles,
  activeFile,
  onToggleFile,
  onSelectRange,
  onSelectAll,
  onCommitted,
  branch,
  loading,
}: Props) {
  const allSelected = files.length > 0 && selectedFiles.size === files.length;

  return (
    <div className="flex flex-col h-full bg-surface-1 border-r border-border-default overflow-hidden">
      {/* Commit section */}
      <CommitSection hasChanges={files.length > 0} onCommitted={onCommitted} />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-default shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-primary uppercase tracking-wider">
            Changes
          </span>
          {files.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-surface-3 text-text-secondary text-[10px] font-medium">
              {files.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {files.length > 1 && (
            <button
              onClick={onSelectAll}
              className="text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
              title={allSelected ? "All selected" : "Select all files"}
            >
              {allSelected
                ? `${selectedFiles.size} selected`
                : "Select all"}
            </button>
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

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-4 text-xs text-text-tertiary">
            Loading...
          </div>
        ) : files.length === 0 ? (
          <div className="px-3 py-4 text-xs text-text-tertiary">
            No changes
          </div>
        ) : (
          files.map((file) => (
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
          ))
        )}
      </div>
    </div>
  );
}
