interface Props {
  header: string;
}

export function HunkHeader({ header }: Props) {
  // Extract function name from hunk header if present
  const match = header.match(/@@ .* @@(.*)/);
  const context = match?.[1]?.trim() || "";

  return (
    <div className="flex font-mono text-[13px] leading-[20px] bg-diff-hunk-bg text-diff-hunk-text border-y border-border-muted">
      <span className="w-[50px] shrink-0" />
      <span className="w-[50px] shrink-0" />
      <span className="w-[20px] shrink-0" />
      <span className="flex-1 py-0.5 select-none">
        {header.match(/@@ .* @@/)?.[0]}
        {context && (
          <span className="ml-2 text-text-secondary">{context}</span>
        )}
      </span>
    </div>
  );
}
