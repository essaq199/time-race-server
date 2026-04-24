import { build } from "esbuild";
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.mjs",
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: true,
});
console.log("Build complete");