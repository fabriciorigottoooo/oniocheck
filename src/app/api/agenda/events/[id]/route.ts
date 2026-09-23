import { eq } from "drizzle-orm";
import { db, ensureDatabaseCompatibility } from "@/db";
import { agendaEventTypes, agendaEvents } from "@/db/schema";
import { publish } from "@/lib/bus";
import { resolveActor } from "@/lib/collab";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await ensureDatabaseCompatibility();
    const { id } = await ctx.params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Corpo inválido." }, { status: 400 });
    }

    const raw = body as {
      title?: unknown;
      typeId?: unknown;
      date?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      notes?: unknown;
      actor?: { id?: unknown; name?: unknown };
    };

    const actor = await resolveActor(raw.actor ?? {});
    if (!actor) {
      return Response.json({ error: "Identifique-se para editar um evento." }, { status: 400 });
    }

    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const typeId = typeof raw.typeId === "string" ? raw.typeId.trim() : "";
    const date = typeof raw.date === "string" ? raw.date.trim() : "";
    const startTime = typeof raw.startTime === "string" ? raw.startTime.trim() : "";
    const endTime = typeof raw.endTime === "string" ? raw.endTime.trim() : "";
    const notes = typeof raw.notes === "string" ? raw.notes.trim() : null;

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
      .update(agendaEvents)
      .set({
        title,
        eventTypeId: typeRow.id,
        date,
        startTime,
        endTime,
        notes: notes || null,
        organizerId: actor.id,
        organizerName: actor.name,
      })
      .where(eq(agendaEvents.id, id))
      .returning();

    if (!row) {
      return Response.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    publish({ type: "change" });

    return Response.json({
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
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Não foi possível editar o evento." }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await ensureDatabaseCompatibility();
    const { id } = await ctx.params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const raw = body as { actor?: { id?: unknown; name?: unknown } };
    const actor = await resolveActor(raw.actor ?? {});
    if (!actor) {
      return Response.json({ error: "Identifique-se para excluir um evento." }, { status: 400 });
    }

    const [deleted] = await db
      .delete(agendaEvents)
      .where(eq(agendaEvents.id, id))
      .returning();

    if (!deleted) {
      return Response.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    publish({ type: "change" });
    return Response.json({ ok: true, deletedId: deleted.id });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Não foi possível excluir o evento." }, { status: 500 });
  }
}
