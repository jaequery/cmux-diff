import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Highlighter | null = null;

const extToLang: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "scss",
  html: "html",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  vue: "vue",
  svelte: "svelte",
  php: "php",
  lua: "lua",
  zig: "zig",
  dockerfile: "dockerfile",
  prisma: "prisma",
};

export function detectLanguage(filePath: string): string | null {
  const name = filePath.split("/").pop() || "";
  const lower = name.toLowerCase();

  if (lower === "dockerfile" || lower.startsWith("dockerfile."))
    return "dockerfile";
  if (lower === "makefile") return "makefile";

  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return extToLang[ext] || null;
}

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["github-dark"],
      langs: [],
    });
  }
  return highlighter;
}

export interface HighlightedToken {
  content: string;
  color?: string;
}

export async function highlightCode(
  code: string,
  lang: string | null
): Promise<HighlightedToken[][]> {
  if (!lang) {
    return code.split("\n").map((line) => [{ content: line }]);
  }

  const hl = await getHighlighter();

  try {
    const loaded = hl.getLoadedLanguages();
    if (!loaded.includes(lang)) {
      await hl.loadLanguage(lang as any);
    }
  } catch {
    return code.split("\n").map((line) => [{ content: line }]);
  }

  const result = hl.codeToTokens(code, {
    lang: lang as any,
    theme: "github-dark",
  });

  return result.tokens.map((line) =>
    line.map((token) => ({
      content: token.content,
      color: token.color,
    }))
  );
}
