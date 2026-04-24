import { build } from "esbuild";
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.cjs",
  format: "cjs",
  platform: "node",
  target: "node22",
  sourcemap: true,
});
console.log("Build complete");