import type { LogEntry } from "../hooks/useDiff";

interface Props {
  entry: LogEntry;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export function CommitItem({ entry, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex flex-col gap-0.5 px-3 py-2 text-left
        transition-colors duration-75 cursor-pointer border-l-2
        ${
          selected
            ? "bg-border-accent/20 text-text-primary border-border-accent"
            : "text-text-secondary hover:bg-surface-2 hover:text-text-primary border-transparent"
        }
      `}
    >
      <span className="text-[13px] break-words text-text-primary">{entry.message}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-text-tertiary shrink-0">
          {entry.hash.slice(0, 7)}
        </span>
        <span className="text-[11px] text-text-tertiary truncate">
          {entry.date}
        </span>
      </div>
    </button>
  );
}
