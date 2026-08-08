/**
 * 数据库迁移执行器
 * - 顺序发现 db/migrations/*.sql
 * - 解析 -- UP / -- DOWN 分段
 * - 在事务内执行，记录到 boks.boks_schema_migrations
 * - checksum 漂移检测
 */
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const MIGRATIONS_DIR = path.join(ROOT, "api/db/migrations");

type Migration = {
  id: string;
  version: number;
  domain: string;
  file: string;
  checksum: string;
  up: string;
  down: string;
};

function parseSplit(body: string): { up: string; down: string } {
  const idx = body.indexOf("-- DOWN");
  if (idx === -1) return { up: body.trim(), down: "" };
  return {
    up: body.slice(0, idx).trim(),
    down: body.slice(idx + "-- DOWN".length).trim(),
  };
}

export async function discover(): Promise<Migration[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) =>
    f.endsWith(".sql"),
  );
  const out: Migration[] = [];
  for (const file of files) {
    const body = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const m = file.match(/^(\d{4})_([^_]+)_(\d{4})_(.+)\.sql$/);
    if (!m) {
      throw new Error(
        `Bad migration filename: ${file}\n` +
          `Expected pattern: NNNN_domain_NNNN_name.sql (e.g. 0010_identity_0010_families.sql)`,
      );
    }
    const [, , domain, versionStr] = m;
    const version = parseInt(versionStr, 10);
    const id = `${domain}/${file}`;
    const checksum = createHash("sha256").update(body).digest("hex");
    const { up, down } = parseSplit(body);
    out.push({ id, version, domain, file, checksum, up, down });
  }
  return out.sort((a, b) => a.version - b.version);
}

export async function ensureMigrationsTable(
  client: import("pg").PoolClient,
): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS boks`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS boks.boks_schema_migrations (
      id              TEXT PRIMARY KEY,
      version         INTEGER NOT NULL,
      domain          TEXT NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      applied_by      TEXT NOT NULL,
      duration_ms     INTEGER NOT NULL,
      rollback_sql    TEXT,
      UNIQUE (domain, version)
    )
  `);
}

export async function migrate(opts: {
  url: string;
  user: string;
  password: string;
  dryRun?: boolean;
}): Promise<{ applied: string[]; skipped: string[]; total: number }> {
  const pool = new Pool({
    connectionString: opts.url,
    user: opts.user,
    password: opts.password,
  });
  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];
  const migrations = await discover();
  try {
    await ensureMigrationsTable(client);
    const { rows } = await client.query<{
      id: string;
      checksum_sha256: string;
    }>(`SELECT id, checksum_sha256 FROM boks.boks_schema_migrations`);
    const appliedMap = new Map(rows.map((r) => [r.id, r.checksum_sha256]));
    for (const m of migrations) {
      const prev = appliedMap.get(m.id);
      if (prev) {
        if (prev !== m.checksum) {
          throw new Error(
            `Migration ${m.id} 已应用但 checksum 漂移：\n` +
              `  applied: ${prev}\n  current: ${m.checksum}\n` +
              `禁止 silent 漂移；请新增一个修复 migration。`,
          );
        }
        skipped.push(m.id);
        continue;
      }
      // eslint-disable-next-line no-console
      console.log(`${opts.dryRun ? "[DRY] " : ""}APPLY ${m.id}`);
      if (opts.dryRun) {
        applied.push(m.id);
        continue;
      }
      const t0 = Date.now();
      await client.query("BEGIN");
      try {
        await client.query(m.up);
        await client.query(
          `INSERT INTO boks.boks_schema_migrations
           (id, version, domain, checksum_sha256, applied_by, duration_ms, rollback_sql)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            m.id,
            m.version,
            m.domain,
            m.checksum,
            opts.user,
            Date.now() - t0,
            m.down,
          ],
        );
        await client.query("COMMIT");
        applied.push(m.id);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  return { applied, skipped, total: migrations.length };
}

export async function rollback(opts: {
  url: string;
  user: string;
  password: string;
  steps?: number;
}): Promise<{ rolledBack: string[] }> {
  const pool = new Pool({
    connectionString: opts.url,
    user: opts.user,
    password: opts.password,
  });
  const client = await pool.connect();
  const rolledBack: string[] = [];
  try {
    const steps = opts.steps ?? 1;
    const { rows } = await client.query<{
      id: string;
      version: number;
      domain: string;
      rollback_sql: string | null;
    }>(
      `SELECT id, version, domain, rollback_sql
       FROM boks.boks_schema_migrations
       ORDER BY version DESC
       LIMIT $1`,
      [steps],
    );
    for (const row of rows) {
      if (!row.rollback_sql) {
        throw new Error(`Migration ${row.id} 未提供 rollback_sql`);
      }
      // eslint-disable-next-line no-console
      console.log(`ROLLBACK ${row.id}`);
      await client.query("BEGIN");
      try {
        await client.query(row.rollback_sql);
        await client.query(
          `DELETE FROM boks.boks_schema_migrations WHERE id = $1`,
          [row.id],
        );
        await client.query("COMMIT");
        rolledBack.push(row.id);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  return { rolledBack };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2] ?? "up";
  const url = process.env.BOKS_DATABASE_URL;
  const user = process.env.BOKS_DATABASE_USER ?? "postgres";
  const password = process.env.BOKS_DATABASE_PASSWORD ?? "";
  if (!url) {
    console.error("BOKS_DATABASE_URL 未设置");
    process.exit(1);
  }
  if (cmd === "up") {
    migrate({
      url,
      user,
      password,
      dryRun: process.argv.includes("--dry-run"),
    }).then(
      (r) => console.log(JSON.stringify(r)),
      (e) => {
        console.error(e);
        process.exit(1);
      },
    );
  } else if (cmd === "down") {
    const steps = parseInt(process.argv[3] ?? "1", 10);
    rollback({ url, user, password, steps }).then(
      (r) => console.log(JSON.stringify(r)),
      (e) => {
        console.error(e);
        process.exit(1);
      },
    );
  }
}
