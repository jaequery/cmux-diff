export interface DiffLine {
  type: "context" | "added" | "removed" | "header";
  content: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  oldPath?: string;
  hunks: DiffHunk[];
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
}

export interface ParsedDiff {
  files: DiffFile[];
}

const hunkHeaderRe = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

export function parseDiff(raw: string): ParsedDiff {
  const files: DiffFile[] = [];
  const lines = raw.split("\n");
  let i = 0;

  while (i < lines.length) {
    // Find diff header
    if (!lines[i]?.startsWith("diff --git")) {
      i++;
      continue;
    }

    const file: DiffFile = {
      path: "",
      hunks: [],
      isNew: false,
      isDeleted: false,
      isRenamed: false,
    };

    // Parse diff header line
    const headerMatch = lines[i].match(/^diff --git a\/(.*) b\/(.*)$/);
    if (headerMatch) {
      const aPath = headerMatch[1];
      const bPath = headerMatch[2];
      file.path = bPath;
      if (aPath !== bPath) {
        file.oldPath = aPath;
        file.isRenamed = true;
      }
    }
    i++;

    // Parse metadata lines
    while (i < lines.length && !lines[i]?.startsWith("diff --git")) {
      const line = lines[i];

      if (line.startsWith("new file")) {
        file.isNew = true;
        i++;
        continue;
      }
      if (line.startsWith("deleted file")) {
        file.isDeleted = true;
        i++;
        continue;
      }
      if (line.startsWith("rename from")) {
        file.oldPath = line.replace("rename from ", "");
        file.isRenamed = true;
        i++;
        continue;
      }
      if (line.startsWith("rename to")) {
        file.path = line.replace("rename to ", "");
        i++;
        continue;
      }
      if (line.startsWith("index ") || line.startsWith("similarity")) {
        i++;
        continue;
      }
      if (line.startsWith("--- ")) {
        i++;
        continue;
      }
      if (line.startsWith("+++ ")) {
        i++;
        continue;
      }

      // Check for hunk header
      const hunkMatch = line.match(hunkHeaderRe);
      if (hunkMatch) {
        const hunk: DiffHunk = {
          header: line,
          oldStart: parseInt(hunkMatch[1], 10),
          oldCount: hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1,
          newStart: parseInt(hunkMatch[3], 10),
          newCount: hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1,
          lines: [],
        };

        let oldLine = hunk.oldStart;
        let newLine = hunk.newStart;
        i++;

        while (i < lines.length) {
          const l = lines[i];
          if (
            l.startsWith("diff --git") ||
            l.match(hunkHeaderRe) ||
            l === undefined
          ) {
            break;
          }

          if (l.startsWith("+")) {
            hunk.lines.push({
              type: "added",
              content: l.slice(1),
              oldLine: null,
              newLine: newLine++,
            });
          } else if (l.startsWith("-")) {
            hunk.lines.push({
              type: "removed",
              content: l.slice(1),
              oldLine: oldLine++,
              newLine: null,
            });
          } else if (l.startsWith(" ")) {
            hunk.lines.push({
              type: "context",
              content: l.slice(1),
              oldLine: oldLine++,
              newLine: newLine++,
            });
          } else if (l.startsWith("\\")) {
            // "No newline at end of file"
            i++;
            continue;
          } else {
            // Empty context line
            hunk.lines.push({
              type: "context",
              content: "",
              oldLine: oldLine++,
              newLine: newLine++,
            });
          }
          i++;
        }

        file.hunks.push(hunk);
        continue;
      }

      // Unknown line, skip
      i++;
    }

    if (file.path) {
      files.push(file);
    }
  }

  return { files };
}
