import type { DiffFile as DiffFileType } from "../lib/diff-parser";
import { DiffFile } from "./DiffFile";
import { EmptyState } from "./EmptyState";
import type { ChangedFile } from "../hooks/useDiff";
import { useRef, useEffect } from "react";

interface SelectedDiff {
  path: string;
  fileInfo?: ChangedFile;
  diff?: DiffFileType | null;
  tokens?: { content: string; color?: string }[][] | null;
}

interface CommitInfo {
  hash: string;
  message: string;
  date: string;
}

interface Props {
  selectedDiffs: SelectedDiff[];
  activeFile: string | null;
  loading: boolean;
  noChanges: boolean;
  onExpandContext?: (filePath: string) => void;
  emptyMessage?: string;
  commitInfo?: CommitInfo | null;
}

const statusLabel: Record<string, string> = {
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
  copied: "Copied",
  untracked: "Untracked",
};

const statusColor: Record<string, string> = {
  added: "text-status-added",
  modified: "text-status-modified",
  deleted: "text-status-deleted",
  renamed: "text-status-renamed",
  copied: "text-text-link",
  untracked: "text-status-untracked",
};

function countChanges(file: DiffFileType): {
  additions: number;
  deletions: number;
} {
  let additions = 0;
  let deletions = 0;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === "added") additions++;
      else if (line.type === "removed") deletions++;
    }
  }
  return { additions, deletions };
}

function FileSection({
  item,
  isActive,
  onExpandContext,
}: {
  item: SelectedDiff;
  isActive: boolean;
  onExpandContext?: (filePath: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const status = item.fileInfo?.status || "modified";

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isActive]);

  const stats = item.diff ? countChanges(item.diff) : null;

  return (
    <div ref={ref} className="border-b border-border-default">
      {/* File header */}
      <div
        className={`flex items-center gap-3 px-4 py-2 border-b border-border-default shrink-0 sticky top-0 z-10 ${
          isActive ? "bg-surface-2" : "bg-surface-1"
        }`}
      >
        <span className="font-mono text-sm text-text-primary truncate">
          {item.path}
        </span>
        <span
          className={`text-xs font-medium ${statusColor[status] || "text-text-secondary"}`}
        >
          {statusLabel[status] || status}
        </span>
        {stats && (
          <div className="flex gap-2 ml-auto text-xs font-mono">
            {stats.additions > 0 && (
              <span className="text-status-added">+{stats.additions}</span>
            )}
            {stats.deletions > 0 && (
              <span className="text-status-deleted">-{stats.deletions}</span>
            )}
          </div>
        )}
      </div>

      {/* Diff content */}
      {!item.diff && item.diff !== undefined ? (
        <div className="px-4 py-3 text-xs text-text-tertiary">
          No diff available
        </div>
      ) : item.diff === undefined ? (
        <div className="px-4 py-3 text-xs text-text-tertiary">
          Loading...
        </div>
      ) : (
        <DiffFile
          file={item.diff}
          tokens={item.tokens}
          onExpandContext={
            onExpandContext ? () => onExpandContext(item.path) : undefined
          }
        />
      )}
    </div>
  );
}

export function DiffPane({
  selectedDiffs,
  activeFile,
  loading,
  noChanges,
  onExpandContext,
  emptyMessage,
  commitInfo,
}: Props) {
  if (noChanges) {
    return <EmptyState message="No changes" />;
  }

  if (selectedDiffs.length === 0) {
    return <EmptyState message={emptyMessage || "Select a file to view changes"} />;
  }

  if (loading && selectedDiffs.every((d) => d.diff === undefined)) {
    return <EmptyState message="Loading diff..." />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Commit info header */}
      {commitInfo && (
        <div className="px-4 py-2.5 bg-surface-2 border-b border-border-default shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[11px] text-text-tertiary">
              {commitInfo.hash.slice(0, 7)}
            </span>
            <span className="text-[11px] text-text-tertiary">
              {commitInfo.date}
            </span>
          </div>
          <div className="text-xs text-text-primary whitespace-pre-wrap">
            {commitInfo.message}
          </div>
        </div>
      )}

      {/* Multi-file indicator */}
      {selectedDiffs.length > 1 && (
        <div className="flex items-center px-4 py-1.5 bg-surface-2 border-b border-border-default text-[11px] text-text-secondary shrink-0">
          Showing {selectedDiffs.length} files
        </div>
      )}

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        {selectedDiffs.map((item) => (
          <FileSection
            key={item.path}
            item={item}
            isActive={item.path === activeFile}
            onExpandContext={onExpandContext}
          />
        ))}
      </div>
    </div>
  );
}
