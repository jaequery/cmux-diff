import type { ChangedFile } from "../hooks/useDiff";

interface Props {
  file: ChangedFile;
  selected: boolean;
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const statusBadge: Record<string, { letter: string; className: string }> = {
  added: { letter: "A", className: "bg-status-added/20 text-status-added" },
  modified: {
    letter: "M",
    className: "bg-status-modified/20 text-status-modified",
  },
  deleted: {
    letter: "D",
    className: "bg-status-deleted/20 text-status-deleted",
  },
  renamed: {
    letter: "R",
    className: "bg-status-renamed/20 text-status-renamed",
  },
  copied: { letter: "C", className: "bg-text-link/20 text-text-link" },
  untracked: {
    letter: "U",
    className: "bg-status-untracked/20 text-status-untracked",
  },
};

export function FileItem({ file, selected, active, onClick }: Props) {
  const badge = statusBadge[file.status] || statusBadge.modified;

  const parts = file.path.split("/");
  const fileName = parts.pop() || file.path;
  const dir = parts.join("/");

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm
        transition-colors duration-75 cursor-pointer
        ${
          active
            ? "bg-border-accent/20 text-text-primary border-l-2 border-border-accent"
            : selected
              ? "bg-[#2a3040] text-text-primary border-l-2 border-border-accent/60"
              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary border-l-2 border-transparent"
        }
      `}
    >
      {/* Status badge */}
      <span
        className={`inline-flex items-center justify-center w-4 h-4 rounded-sm text-[10px] font-bold leading-none shrink-0 ${badge.className}`}
      >
        {badge.letter}
      </span>

      {/* File path */}
      <span className="break-all font-mono text-xs">
        {dir && <span className="text-text-tertiary">{dir}/</span>}
        <span>{fileName}</span>
      </span>
    </button>
  );
}
