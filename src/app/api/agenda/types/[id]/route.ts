import { eq } from "drizzle-orm";
import { db, ensureDatabaseCompatibility } from "@/db";
import { agendaEventTypes } from "@/db/schema";
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
      name?: unknown;
      color?: unknown;
      actor?: { id?: unknown; name?: unknown };
    };

    const actor = await resolveActor(raw.actor ?? {});
    if (!actor) {
      return Response.json({ error: "Identifique-se para editar um tipo de evento." }, { status: 400 });
    }

    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name || name.length > 40) {
      return Response.json({ error: "Nome do tipo de evento inválido." }, { status: 400 });
    }

    let color = typeof raw.color === "string" ? raw.color.trim() : "#2d6fe8";
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = "#2d6fe8";

    const [row] = await db
      .update(agendaEventTypes)
      .set({ name, color })
      .where(eq(agendaEventTypes.id, id))
      .returning();

    if (!row) {
      return Response.json({ error: "Tipo de evento não encontrado." }, { status: 404 });
    }

    publish({ type: "change" });
    return Response.json({ ok: true, agendaType: row });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Não foi possível editar o tipo de evento." }, { status: 500 });
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
      return Response.json({ error: "Identifique-se para excluir um tipo de evento." }, { status: 400 });
    }

    const [deleted] = await db
      .delete(agendaEventTypes)
      .where(eq(agendaEventTypes.id, id))
      .returning();

    if (!deleted) {
      return Response.json({ error: "Tipo de evento não encontrado." }, { status: 404 });
    }

    publish({ type: "change" });
    return Response.json({ ok: true, deletedId: deleted.id });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Não foi possível excluir o tipo de evento." }, { status: 500 });
  }
}
