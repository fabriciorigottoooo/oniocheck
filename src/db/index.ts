import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

export async function ensureDatabaseCompatibility() {
  await db.execute(`
    ALTER TABLE IF EXISTS clients
      ADD COLUMN IF NOT EXISTS economic_group text,
      ADD COLUMN IF NOT EXISTS attendance_unit text;
  `);

  await db.execute(`
    ALTER TABLE IF EXISTS collaborators
      ADD COLUMN IF NOT EXISTS color text,
      ADD COLUMN IF NOT EXISTS avatar_url text,
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
  `);

  await db.execute(`
    UPDATE collaborators
    SET color = COALESCE(color, '#2a9b81')
    WHERE color IS NULL;
  `);

  await db.execute(`
    UPDATE collaborators
    SET last_seen_at = COALESCE(last_seen_at, NOW())
    WHERE last_seen_at IS NULL;
  `);
}
