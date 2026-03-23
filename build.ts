import tailwind from "bun-plugin-tailwind";

await Bun.build({
  entrypoints: ["./src/frontend.tsx"],
  outdir: "./dist",
  plugins: [tailwind],
  minify: true,
  sourcemap: "linked",
  target: "browser",
});

console.log("Build complete");
