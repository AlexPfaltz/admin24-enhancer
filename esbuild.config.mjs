import { build, context } from "esbuild";
import { rm, mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "src");
const DIST = path.join(__dirname, "dist");

const TARGET = process.argv[2];
const WATCH = process.argv.includes("--watch");

if (TARGET !== "firefox" && TARGET !== "chrome") {
  console.error("Usage: node esbuild.config.mjs <firefox|chrome> [--watch]");
  process.exit(1);
}

const OUT = path.join(DIST, TARGET);

const tsResolvePlugin = {
  name: "ts-resolve",
  setup(build) {
    build.onResolve({ filter: /\.js$/ }, (args) => {
      if (args.kind !== "import-statement") return null;
      if (!args.path.startsWith(".")) return null;
      const abs = path.resolve(args.resolveDir, args.path);
      const ts = abs.replace(/\.js$/, ".ts");
      if (existsSync(ts)) return { path: ts };
      return null;
    });
  },
};

const common = {
  bundle: true,
  target: ["firefox115", "chrome114"],
  sourcemap: WATCH ? "inline" : false,
  minify: !WATCH,
  logLevel: "info",
  legalComments: "none",
  plugins: [tsResolvePlugin],
};

const entries = [
  {
    ...common,
    entryPoints: [path.join(SRC, "screens/tickets-list/index.ts")],
    outfile: path.join(OUT, "content.js"),
    format: "iife",
  },
  {
    ...common,
    entryPoints: [path.join(SRC, "background/service-worker.ts")],
    outfile: path.join(OUT, "background.js"),
    format: "esm",
  },
  {
    ...common,
    entryPoints: [path.join(SRC, "popup/popup.ts")],
    outfile: path.join(OUT, "popup.js"),
    format: "iife",
  },
  {
    // Инжектится в page world. Собирается как IIFE — на странице
    // Admin24 нет модульной системы, import-ы не сработают.
    // Не минифицируется: хотим видеть осмысленные ошибки в консоли
    // страницы (её пользователь видит через DevTools).
    ...common,
    entryPoints: [path.join(SRC, "screens/ticket-detailed/vue-bridge-injected.ts")],
    outfile: path.join(OUT, "vue-bridge-injected.js"),
    format: "iife",
    minify: false,
  },
];

async function copyStatic() {
  const manifestSrc = path.join(__dirname, `manifest.${TARGET}.json`);
  const manifestDst = path.join(OUT, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestSrc, "utf8"));
  await writeFile(manifestDst, JSON.stringify(manifest, null, 2));

  await copyFile(
    path.join(SRC, "popup/popup.html"),
    path.join(OUT, "popup.html")
  );
  await copyFile(
    path.join(SRC, "popup/popup.css"),
    path.join(OUT, "popup.css")
  );
  await copyFile(
    path.join(SRC, "screens/tickets-list/tickets-list.css"),
    path.join(OUT, "tickets-list.css")
  );
  await copyFile(
    path.join(SRC, "screens/theme/theme.css"),
    path.join(OUT, "theme.css")
  );
  await copyFile(
    path.join(SRC, "core/themes.json"),
    path.join(OUT, "themes.json")
  );
}

async function run() {
  if (!WATCH) {
    if (existsSync(OUT)) await rm(OUT, { recursive: true, force: true });
  }
  await mkdir(OUT, { recursive: true });
  await copyStatic();

  if (WATCH) {
    for (const cfg of entries) {
      const ctx = await context(cfg);
      await ctx.watch();
    }
    console.log(`[${TARGET}] watching...`);
  } else {
    await Promise.all(entries.map((cfg) => build(cfg)));
    console.log(`[${TARGET}] build done → dist/${TARGET}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});