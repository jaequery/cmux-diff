import tailwind from "bun-plugin-tailwind";
import path from "path";

const outdir = "./dist";

const result = await Bun.build({
  entrypoints: ["./src/index.html"],
  outdir,
  plugins: [tailwind],
  minify: true,
  sourcemap: "linked",
  target: "browser",
});

if (!result.success) {
  console.error("Build failed:", result.logs);
  process.exit(1);
}

console.log("Build complete");
