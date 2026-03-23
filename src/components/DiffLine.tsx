import type { DiffLine as DiffLineType } from "../lib/diff-parser";

interface Props {
  line: DiffLineType;
  tokens?: { content: string; color?: string }[];
}

export function DiffLine({ line, tokens }: Props) {
  const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";

  const bgClass =
    line.type === "added"
      ? "bg-diff-added-bg"
      : line.type === "removed"
        ? "bg-diff-removed-bg"
        : "";

  const gutterClass =
    line.type === "added"
      ? "bg-diff-added-gutter text-diff-added-text"
      : line.type === "removed"
        ? "bg-diff-removed-gutter text-diff-removed-text"
        : "text-text-tertiary";

  const prefixClass =
    line.type === "added"
      ? "text-diff-added-text"
      : line.type === "removed"
        ? "text-diff-removed-text"
        : "text-text-tertiary";

  return (
    <div className={`flex font-mono text-[13px] leading-[20px] ${bgClass} hover:brightness-110`}>
      {/* Old line number */}
      <span
        className={`w-[50px] shrink-0 text-right pr-2 select-none text-xs leading-[20px] ${gutterClass}`}
      >
        {line.oldLine ?? ""}
      </span>
      {/* New line number */}
      <span
        className={`w-[50px] shrink-0 text-right pr-2 select-none text-xs leading-[20px] ${gutterClass}`}
      >
        {line.newLine ?? ""}
      </span>
      {/* Prefix */}
      <span
        className={`w-[20px] shrink-0 text-center select-none ${prefixClass}`}
      >
        {prefix}
      </span>
      {/* Content */}
      <span className="flex-1 whitespace-pre-wrap break-all pr-4">
        {tokens ? (
          tokens.map((token, i) => (
            <span key={i} style={token.color ? { color: token.color } : undefined}>
              {token.content}
            </span>
          ))
        ) : (
          line.content
        )}
      </span>
    </div>
  );
}
