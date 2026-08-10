/**
 * 校验三端 token 字段一致率（规范化 key 后比较）
 */
const fs = require("node:fs");
const path = require("node:path");

const files = {
  scss: "build/scss/_tokens.scss",
  css: "build/variables.css",
  js: "build/tokens.js",
  dart: "build/dart/boks_tokens.dart",
};

function normalize(k) {
  return k.replace(/[_-]/g, "").toLowerCase();
}

function extractKeys(file, parser) {
  const content = fs.readFileSync(path.join(__dirname, file), "utf8");
  return new Set(parser(content).map(normalize));
}

const parsers = {
  scss: (c) => {
    const m = c.match(/\$([a-z0-9\-]+)\s*:/g) || [];
    return m.map((s) => s.replace(/^\$/, "").replace(/\s*:\s*$/, ""));
  },
  css: (c) => {
    const m = c.match(/--([a-z0-9\-]+)\s*:/g) || [];
    return m.map((s) => s.replace(/\s*:\s*$/, ""));
  },
  js: (c) => {
    const m = c.match(/\b([A-Z][A-Za-z0-9_]+)\s*:/g) || [];
    return m.map((s) => s.replace(/\s*:\s*$/, ""));
  },
  dart: (c) => {
    const m = c.match(/static const String ([A-Z][A-Z0-9_]+)/g) || [];
    return m.map((s) => s.replace(/^static const String /, ""));
  },
};

const sets = {};
for (const [k, f] of Object.entries(files)) {
  sets[k] = extractKeys(f, parsers[k]);
}

const all = new Set();
for (const s of Object.values(sets)) for (const k of s) all.add(k);

const total = all.size;
let missing = 0;
const detail = {};
for (const [k, s] of Object.entries(sets)) {
  detail[k] = total - s.size;
  missing += total - s.size;
}

const rate = 1 - missing / (total * Object.keys(files).length);
console.log(
  `token 一致率 ${(rate * 100).toFixed(1)}%（共 ${total} keys，各端缺失 ${JSON.stringify(detail)}）`,
);
if (rate < 0.999) {
  process.exit(1);
}
