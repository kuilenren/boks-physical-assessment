#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  "$1",
);
const FAILURES = [];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

const files = await walk(DIST);
console.log(`[verify-dist] scanning ${files.length} js files in ${DIST}`);

const mwRe = /\.mw\./g;
const oldMw = /\bf\.mw\./g;

let totalMw = 0;
for (const file of files) {
  const text = await readFile(file, "utf8");
  const matches = text.match(mwRe) || [];
  if (matches.length > 0) {
    totalMw += matches.length;
    FAILURES.push(
      `[mw] ${relative(DIST, file)}: ${matches.length} occurrences`,
    );
  }
}

const appJs = await readFile(join(DIST, "app.js"), "utf8");
const runtimeChunk = await readFile(join(DIST, "runtime.js"), "utf8");
const appJson = JSON.parse(await readFile(join(DIST, "app.json"), "utf8"));

if (!appJs.includes('require("./runtime")')) {
  FAILURES.push("[runtime] app.js does not require('./runtime')");
}

if (!appJs.includes("webpackJsonp")) {
  FAILURES.push("[runtime] app.js does not register webpackJsonp");
}

if (!appJson.pages || appJson.pages.length === 0) {
  FAILURES.push("[pages] app.json has no pages");
}

if (runtimeChunk.length > 8192) {
  FAILURES.push(
    `[runtime] runtime.js too large (${runtimeChunk.length} bytes)`,
  );
}

if (totalMw > 0) {
  FAILURES.push(`[mangleExports] residual .mw. references: ${totalMw} total`);
}

if (FAILURES.length > 0) {
  console.error("\n[verify-dist] FAILURES:");
  for (const f of FAILURES) console.error("  -", f);
  process.exit(1);
}

console.log(
  `[verify-dist] OK — app.js=${appJs.length}B runtime.js=${runtimeChunk.length}B pages=${appJson.pages.length}`,
);
