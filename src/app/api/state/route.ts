import { randomUUID } from "crypto";
import { asc, count, desc } from "drizzle-orm";
import { db } from "@/db";
import { activities, clients, collaborators } from "@/db/schema";
import { toActivity, toClient, toCollab } from "@/lib/mappers";
import { SEED, checksFromBits } from "@/lib/steps";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const g = globalThis as { __checkflowSeeded?: boolean };

async function ensureSeed() {
  if (g.__checkflowSeeded) return;
  const [{ n: nClients }] = await db.select({ n: count() }).from(clients);
  const [{ n: nCollabs }] = await db.select({ n: count() }).from(collaborators);
  if (nClients === 0 && nCollabs === 0) {
    await db.insert(clients).values(
      SEED.map(([name, bits]) => ({
        id: randomUUID(),
        name,
        checks: checksFromBits(bits),
      })),
    );
  }
  g.__checkflowSeeded = true;
}

export async function GET() {
  try {
    await ensureSeed();
    const [clientRows, collabRows, activityRows] = await Promise.all([
      db.select().from(clients).orderBy(asc(clients.createdAt)),
      db.select().from(collaborators).orderBy(asc(collaborators.createdAt)),
      db
        .select()
        .from(activities)
        .orderBy(desc(activities.createdAt))
        .limit(30),
    ]);
    const payload: AppState = {
      clients: clientRows.map(toClient),
      collaborators: collabRows.map(toCollab),
      activities: activityRows.map(toActivity),
      serverTime: new Date().toISOString(),
    };
    return Response.json(payload);
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: "Não foi possível carregar os dados." },
      { status: 500 },
    );
  }
}
