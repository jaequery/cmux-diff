interface Props {
  linesAbove?: number;
  linesBelow?: number;
  onExpand: () => void;
  position: "top" | "middle" | "bottom";
}

export function CollapsedRegion({
  linesAbove,
  linesBelow,
  onExpand,
  position,
}: Props) {
  const count = linesAbove || linesBelow || 0;
  if (count <= 0) return null;

  const label =
    position === "top"
      ? `Show ${count} lines above`
      : position === "bottom"
        ? `Show ${count} lines below`
        : `Show ${count} hidden lines`;

  return (
    <button
      onClick={onExpand}
      className="flex w-full items-center font-mono text-[11px] leading-[20px] text-text-link hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer select-none group"
    >
      <span className="w-[50px] shrink-0" />
      <span className="w-[50px] shrink-0" />
      <span className="w-[20px] shrink-0 text-center text-text-tertiary group-hover:text-text-link">
        {position === "top" ? "\u2191" : position === "bottom" ? "\u2193" : "\u2195"}
      </span>
      <span className="flex-1 py-0.5 border-y border-dashed border-border-muted">
        {label}
      </span>
    </button>
  );
}
