import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, ensureDatabaseCompatibility } from "@/db";
import { agendaEventTypes, agendaEvents } from "@/db/schema";
import { publish } from "@/lib/bus";
import { resolveActor } from "@/lib/collab";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureDatabaseCompatibility();
    const body = (await req.json().catch(() => ({}))) as {
      title?: unknown;
      typeId?: unknown;
      date?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      notes?: unknown;
      meetingUrl?: unknown;
      finished?: unknown;
      actor?: { id?: unknown; name?: unknown };
    };

    const actor = await resolveActor(body.actor ?? {});
    if (!actor) {
      return Response.json({ error: "Identifique-se para agendar um evento." }, { status: 400 });
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const typeId = typeof body.typeId === "string" ? body.typeId.trim() : "";
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
    const endTime = typeof body.endTime === "string" ? body.endTime.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : null;
    const meetingUrl = typeof body.meetingUrl === "string" ? body.meetingUrl.trim() : null;
    const finished = body.finished === true;

    if (!title || title.length > 100) {
      return Response.json({ error: "Título do evento inválido." }, { status: 400 });
    }
    if (!typeId || !date || !startTime || !endTime) {
      return Response.json({ error: "Preencha dia, horário e tipo do evento." }, { status: 400 });
    }

    const [typeRow] = await db
      .select()
      .from(agendaEventTypes)
      .where(eq(agendaEventTypes.id, typeId))
      .limit(1);

    if (!typeRow) {
      return Response.json({ error: "Tipo de evento não encontrado." }, { status: 404 });
    }

    const [row] = await db
      .insert(agendaEvents)
      .values({
        id: randomUUID(),
        title,
        eventTypeId: typeRow.id,
        date,
        startTime,
        endTime,
        notes: notes || null,
        meetingUrl: meetingUrl || null,
        finishedAt: finished ? new Date() : null,
        organizerId: actor.id,
        organizerName: actor.name,
      })
      .returning();

    publish({ type: "change" });
    return Response.json(
      {
        ok: true,
        event: {
          id: row.id,
          title: row.title,
          typeId: row.eventTypeId,
          typeName: typeRow.name,
          typeColor: typeRow.color,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          notes: row.notes,
          organizerId: row.organizerId,
          organizerName: row.organizerName,
          createdAt: row.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Não foi possível agendar o evento." }, { status: 500 });
  }
}
