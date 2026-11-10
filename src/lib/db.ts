import { neon, NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon Postgres (free tier, installed from the Vercel Marketplace which sets
 * DATABASE_URL automatically). The schema is applied on first use so there is
 * no migration tool to run.
 */

let _sql: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

export function sql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Add the Neon integration in Vercel or set it in .env.");
    _sql = neon(url);
  }
  return _sql;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value JSONB NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS search_runs (
     id SERIAL PRIMARY KEY,
     started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     finished_at TIMESTAMPTZ,
     status TEXT NOT NULL DEFAULT 'running',
     params JSONB,
     stats JSONB
   )`,
  `CREATE TABLE IF NOT EXISTS search_staging (
     id SERIAL PRIMARY KEY,
     run_id INTEGER NOT NULL,
     source_id TEXT NOT NULL,
     data JSONB NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS search_staging_run ON search_staging(run_id)`,
  `CREATE TABLE IF NOT EXISTS opportunities (
     id TEXT PRIMARY KEY,
     data JSONB NOT NULL,
     score INTEGER NOT NULL DEFAULT 0,
     live_status TEXT,
     change_status TEXT,
     deadline TIMESTAMPTZ,
     first_seen_run INTEGER,
     last_seen_run INTEGER,
     first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS opportunity_changes (
     id SERIAL PRIMARY KEY,
     opportunity_id TEXT NOT NULL,
     run_id INTEGER,
     field TEXT NOT NULL,
     old_value TEXT,
     new_value TEXT,
     changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS decisions (
     opportunity_id TEXT PRIMARY KEY,
     decision TEXT NOT NULL DEFAULT 'NONE',
     selected BOOLEAN NOT NULL DEFAULT false,
     notes TEXT NOT NULL DEFAULT '',
     analysis JSONB,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS reports (
     id SERIAL PRIMARY KEY,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     title TEXT NOT NULL,
     reporting_date DATE NOT NULL,
     opportunity_count INTEGER NOT NULL,
     combined_value NUMERIC,
     data JSONB NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS source_status (
     source_id TEXT PRIMARY KEY,
     status TEXT NOT NULL,
     message TEXT,
     notices_checked INTEGER DEFAULT 0,
     checked_at TIMESTAMPTZ,
     run_id INTEGER
   )`,
];

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const q = sql();
      for (const stmt of SCHEMA) await q.query(stmt);
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

/** Run a parameterised query after making sure the schema exists. */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const rows = await sql().query(text, params);
  return rows as T[];
}
