import { build } from "esbuild";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);

const { pino } = await import("esbuild-plugin-pino").catch(() => ({ pino: () => ({}) }));

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.mjs",
  format: "esm",
  platform: "node",
  target: "node20",
  sourcemap: true,
  plugins: [pino({ transports: ["pino-pretty"] })],
  external: [],
});
console.log("Build complete");
