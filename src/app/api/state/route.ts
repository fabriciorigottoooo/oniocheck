import { randomUUID } from "crypto";
import { asc, count, desc, lt } from "drizzle-orm";
import { db, ensureDatabaseCompatibility } from "@/db";
import { activities, agendaEventTypes, agendaEvents, clients, collaborators } from "@/db/schema";
import { toActivity, toAgendaType, toClient, toCollab } from "@/lib/mappers";
import { SEED, checksFromBits } from "@/lib/steps";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const g = globalThis as {
  __oniocheckSeeded?: boolean;
  __checkflowSeeded?: boolean;
};

async function ensureSeed() {
  if (g.__oniocheckSeeded || g.__checkflowSeeded) return;
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
  g.__oniocheckSeeded = true;
  g.__checkflowSeeded = true;
}

export async function GET() {
  try {
    await ensureDatabaseCompatibility();
    await ensureSeed();
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await db.delete(activities).where(lt(activities.createdAt, cutoff));
    const [clientRows, collabRows, activityRows, typeRows, eventRows] = await Promise.all([
      db.select().from(clients).orderBy(asc(clients.createdAt)),
      db.select().from(collaborators).orderBy(asc(collaborators.createdAt)),
      db
        .select()
        .from(activities)
        .orderBy(desc(activities.createdAt))
        .limit(30),
      db.select().from(agendaEventTypes).orderBy(asc(agendaEventTypes.name)),
      db.select().from(agendaEvents).orderBy(asc(agendaEvents.date), asc(agendaEvents.startTime)),
    ]);
    const typeMap = new Map(typeRows.map((typeRow) => [typeRow.id, typeRow]));
    const agendaEventsPayload = eventRows.map((eventRow) => {
      const type = typeMap.get(eventRow.eventTypeId) ?? {
        id: eventRow.eventTypeId,
        name: "Evento",
        color: "#2d6fe8",
      };
      return {
        id: eventRow.id,
        title: eventRow.title,
        typeId: eventRow.eventTypeId,
        typeName: type.name,
        typeColor: type.color,
        date: eventRow.date,
        startTime: eventRow.startTime,
        endTime: eventRow.endTime,
        notes: eventRow.notes,
        meetingUrl: eventRow.meetingUrl ?? null,
        finishedAt: eventRow.finishedAt ? eventRow.finishedAt.toISOString() : null,
        organizerId: eventRow.organizerId,
        organizerName: eventRow.organizerName,
        createdAt: eventRow.createdAt.toISOString(),
      };
    });
    const payload: AppState = {
      clients: clientRows.map(toClient),
      collaborators: collabRows.map(toCollab),
      activities: activityRows.map(toActivity),
      agendaTypes: typeRows.map(toAgendaType),
      agendaEvents: agendaEventsPayload,
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
