import type { ChangedFile, LogEntry } from "../hooks/useDiff";
import { FileItem } from "./FileItem";
import { CommitItem } from "./CommitItem";
import { CommitSection } from "./CommitSection";
import { AccordionSection } from "./AccordionSection";

interface Props {
  // View mode
  viewMode: "uncommitted" | "commits";
  // Uncommitted
  uncommittedFiles: ChangedFile[];
  onSwitchToUncommitted: () => void;
  onCommitted: () => void;
  ahead: number;
  onPushed: () => void;
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
  ahead,
  onPushed,
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
  const showCommitFiles = !isUncommittedView && selectedCommits.size > 0 && files.length > 0;

  return (
    <div className="flex flex-col h-full bg-surface-1 border-r border-border-default overflow-hidden" style={{ padding: 8, gap: 6 }}>
      {/* Branch */}
      <div className="flex items-center justify-between px-3 py-1.5 border border-border-default rounded-md shrink-0">
        {branch && (
          <span
            className="text-[11px] text-text-tertiary font-mono truncate"
            title={branch}
          >
            {branch}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden border border-border-default rounded-md">
        {loading ? (
          <div className="px-3 py-4 text-xs text-text-tertiary">Loading...</div>
        ) : (
          <>
            {/* Commit Message */}
            {!commitMode && (uncommittedFiles.length > 0 || ahead > 0) && (
              <AccordionSection
                id="commit-message"
                title="Commit"
                defaultHeight={120}
                minHeight={60}
              >
                <div className="px-3 pb-2">
                  <CommitSection
                    hasChanges={uncommittedFiles.length > 0}
                    onCommitted={onCommitted}
                    ahead={ahead}
                    onPushed={onPushed}
                  />
                </div>
              </AccordionSection>
            )}

            {/* Uncommitted Changes */}
            <AccordionSection
              id="uncommitted"
              title="Uncommitted"
              defaultHeight={180}
              minHeight={40}
              badge={
                uncommittedFiles.length > 0 ? (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-surface-3 text-text-secondary text-[11px] font-medium">
                    {uncommittedFiles.length}
                  </span>
                ) : undefined
              }
              rightContent={
                isUncommittedView && files.length > 1 ? (
                  <button
                    onClick={onSelectAll}
                    className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    {allFilesSelected ? `${selectedFiles.size} selected` : "Select all"}
                  </button>
                ) : undefined
              }
            >
              <div
                className="py-0.5 cursor-pointer"
                onClick={onSwitchToUncommitted}
              >
                {uncommittedFiles.length > 0 ? (
                  isUncommittedView ? (
                    uncommittedFiles.map((file) => (
                      <FileItem
                        key={file.path}
                        file={file}
                        selected={selectedFiles.has(file.path)}
                        active={activeFile === file.path}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.shiftKey
                            ? onSelectRange(file.path)
                            : onToggleFile(file.path);
                        }}
                      />
                    ))
                  ) : (
                    <div className="px-3 py-1.5 text-[12px] text-text-tertiary">
                      {uncommittedFiles.length} changed file{uncommittedFiles.length !== 1 ? "s" : ""}
                    </div>
                  )
                ) : (
                  <div className="px-3 py-1.5 text-[12px] text-text-tertiary">
                    No uncommitted changes
                  </div>
                )}
              </div>
            </AccordionSection>

            {/* Commits */}
            <AccordionSection
              id="commits"
              title="Commits"
              minHeight={60}
              flex={!showCommitFiles}
              badge={
                selectedCommits.size > 1 ? (
                  <span className="text-[11px] text-text-tertiary">
                    {selectedCommits.size} selected
                  </span>
                ) : undefined
              }
            >
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
                    className="w-full px-3 py-2 text-[12px] text-text-tertiary hover:text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    Show more...
                  </button>
                )}
              </div>
            </AccordionSection>

            {/* Files for selected commit(s) */}
            {showCommitFiles && (
              <AccordionSection
                id="commit-files"
                title="Files"
                minHeight={60}
                flex
                badge={
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-surface-3 text-text-secondary text-[11px] font-medium">
                    {files.length}
                  </span>
                }
                rightContent={
                  files.length > 1 ? (
                    <button
                      onClick={onSelectAll}
                      className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
                    >
                      {allFilesSelected ? `${selectedFiles.size} selected` : "Select all"}
                    </button>
                  ) : undefined
                }
              >
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
              </AccordionSection>
            )}
          </>
        )}
      </div>
    </div>
  );
}
