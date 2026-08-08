/**
 * 直接应用所有 SQL migrations（Node 实现，绕过 tsx 启动问题）
 * - 读取每个 .sql 文件，只保留 -- UP 之前的内容
 * - 通过 pg 客户端连接 boks-pgvector 应用
 * - 失败立即退出
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = "D:/boks/bokstice/services/api/db/migrations";
const url = process.env.BOKS_DATABASE_URL ?? "postgresql://boks:boks-local-only@localhost:5433/boks";

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
console.log(`发现 ${files.length} 个 migrations`);

const client = new Client({ connectionString: url });
await client.connect();

let applied = 0;
for (const f of files) {
  const body = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
  const idx = body.indexOf("-- DOWN");
  const up = (idx === -1 ? body : body.slice(0, idx)).trim();
  process.stdout.write(`[${f}] `);
  try {
    // 拆分语句：以分号（不在 dollar-quote 内）为分隔
    const statements = splitSqlStatements(up);
    for (const stmt of statements) {
      if (stmt.trim()) await client.query(stmt);
    }
    console.log("OK");
    applied++;
  } catch (e) {
    console.error("FAIL:", e.message);
    process.exit(1);
  }
}

/** 简单 SQL 拆分：尊重 dollar-quote ($tag$ ... $tag$) */
function splitSqlStatements(sql) {
  const stmts = [];
  let buf = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    // dollar-quote
    if (c === "$") {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        buf += m[0];
        i += m[0].length;
        const end = sql.indexOf(m[0], i);
        if (end === -1) {
          buf += sql.slice(i);
          i = sql.length;
        } else {
          buf += sql.slice(i, end + m[0].length);
          i = end + m[0].length;
        }
        continue;
      }
    }
    if (c === ";" && (i === sql.length - 1 || sql[i + 1] === "\n" || sql[i + 1] === " ")) {
      stmts.push(buf);
      buf = "";
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  if (buf.trim()) stmts.push(buf);
  return stmts;
}

await client.end();
console.log(`\n应用完成：${applied}/${files.length}`);

// 验证
const verify = new Client({ connectionString: url });
await verify.connect();
const { rows } = await verify.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='boks'");
console.log(`boks schema 表数：${rows[0].n}`);
const { rows: rlsRows } = await verify.query(
  "SELECT count(*)::int AS n FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='boks' AND c.relrowsecurity=true",
);
console.log(`启用 RLS 的表数：${rlsRows[0].n}`);
const { rows: vecRows } = await verify.query(
  "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='boks' AND data_type='USER-DEFINED' AND udt_name='vector'",
);
console.log(`pgvector 列数：${vecRows[0].n}`);
await verify.end();