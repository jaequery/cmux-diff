import path from "path";
import tailwind from "bun-plugin-tailwind";

const srcDir = path.join(import.meta.dir, "src");
const distDir = path.join(import.meta.dir, ".dist");

// Step 1: Build frontend assets
console.log("Building frontend...");
const frontendResult = await Bun.build({
  entrypoints: [path.join(srcDir, "index.html")],
  outdir: distDir,
  plugins: [tailwind],
  target: "browser",
  minify: true,
  sourcemap: "linked",
});

if (!frontendResult.success) {
  console.error("Frontend build failed:", frontendResult.logs);
  process.exit(1);
}
console.log("Frontend built.");

// Step 2: Compile standalone binary
console.log("Compiling binary...");
const result = await Bun.build({
  entrypoints: [path.join(srcDir, "cli.ts")],
  outdir: path.join(import.meta.dir, "bin"),
  target: "bun",
  minify: true,
  compile: true,
  external: ["bun-plugin-tailwind"],
});

if (!result.success) {
  console.error("Binary compilation failed:", result.logs);
  process.exit(1);
}

console.log("Binary compiled to bin/cmux-diff");
