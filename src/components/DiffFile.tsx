import type { DiffFile as DiffFileType } from "../lib/diff-parser";
import { DiffLine } from "./DiffLine";
import { HunkHeader } from "./HunkHeader";
import { CollapsedRegion } from "./CollapsedRegion";

interface Props {
  file: DiffFileType;
  tokens?: { content: string; color?: string }[][] | null;
  onExpandContext?: () => void;
}

export function DiffFile({ file, tokens, onExpandContext }: Props) {
  let tokenIndex = 0;

  // Calculate gaps between hunks and at edges
  const gaps: { before: number; position: "top" | "middle" | "bottom" }[] = [];

  for (let i = 0; i < file.hunks.length; i++) {
    const hunk = file.hunks[i];
    if (i === 0 && hunk.oldStart > 1 && !file.isNew) {
      // Lines before first hunk
      gaps.push({ before: hunk.oldStart - 1, position: "top" });
    } else if (i > 0) {
      // Lines between hunks
      const prevHunk = file.hunks[i - 1];
      const prevEnd = prevHunk.oldStart + prevHunk.oldCount;
      const gapSize = hunk.oldStart - prevEnd;
      if (gapSize > 0) {
        gaps.push({ before: gapSize, position: "middle" });
      } else {
        gaps.push({ before: 0, position: "middle" });
      }
    }
  }

  return (
    <div className="border-b border-border-default overflow-x-auto">
      {file.hunks.map((hunk, hi) => {
        const gap = gaps[hi];

        return (
          <div key={hi}>
            {/* Expand region before this hunk */}
            {gap && gap.before > 0 && onExpandContext && (
              <CollapsedRegion
                linesAbove={gap.before}
                onExpand={onExpandContext}
                position={gap.position}
              />
            )}
            <HunkHeader header={hunk.header} />
            {hunk.lines.map((line, li) => {
              const lineTokens = tokens?.[tokenIndex];
              tokenIndex++;
              return <DiffLine key={li} line={line} tokens={lineTokens} />;
            })}
          </div>
        );
      })}

      {/* Expand region after last hunk (if file continues) */}
      {file.hunks.length > 0 && !file.isNew && onExpandContext && (
        <CollapsedRegion
          linesBelow={20}
          onExpand={onExpandContext}
          position="bottom"
        />
      )}
    </div>
  );
}
