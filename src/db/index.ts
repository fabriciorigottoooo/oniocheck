import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { agendaEventTypes } from "@/db/schema";

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

async function ensureAgendaDefaults() {
  const rows = await db.select().from(agendaEventTypes);
  if (rows.length > 0) return;

  await db.insert(agendaEventTypes).values([
    { id: randomUUID(), name: "Reunião", color: "#2d6fe8" },
    { id: randomUUID(), name: "Conferência", color: "#7c3aed" },
    { id: randomUUID(), name: "Follow-up", color: "#16a34a" },
  ]);
}

export async function ensureDatabaseCompatibility() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agenda_event_types (
      id text PRIMARY KEY,
      name text NOT NULL,
      color text NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS agenda_events (
      id text PRIMARY KEY,
      title text NOT NULL,
      event_type_id text NOT NULL,
      date text NOT NULL,
      start_time text NOT NULL,
      end_time text NOT NULL,
      notes text,
      meeting_url text,
      finished_at TIMESTAMPTZ,
      organizer_id text NOT NULL,
      organizer_name text NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(`
    ALTER TABLE IF EXISTS agenda_events
      ADD COLUMN IF NOT EXISTS meeting_url text,
      ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
  `);

  await db.execute(`
    ALTER TABLE IF EXISTS clients
      ADD COLUMN IF NOT EXISTS economic_group text,
      ADD COLUMN IF NOT EXISTS attendance_unit text,
      ADD COLUMN IF NOT EXISTS phone text;
  `);

  await db.execute(`
    ALTER TABLE IF EXISTS collaborators
      ADD COLUMN IF NOT EXISTS display_name text,
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

  await ensureAgendaDefaults();
}
