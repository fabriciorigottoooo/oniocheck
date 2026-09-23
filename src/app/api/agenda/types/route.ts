import { randomUUID } from "crypto";
import { db, ensureDatabaseCompatibility } from "@/db";
import { agendaEventTypes } from "@/db/schema";
import { publish } from "@/lib/bus";
import { resolveActor } from "@/lib/collab";
import { toAgendaType } from "@/lib/mappers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureDatabaseCompatibility();
    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      color?: unknown;
      actor?: { id?: unknown; name?: unknown };
    };

    const actor = await resolveActor(body.actor ?? {});
    if (!actor) {
      return Response.json({ error: "Identifique-se para criar um tipo de evento." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 40) {
      return Response.json({ error: "Nome do tipo de evento inválido." }, { status: 400 });
    }

    let color = typeof body.color === "string" ? body.color.trim() : "#2d6fe8";
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = "#2d6fe8";

    const [row] = await db
      .insert(agendaEventTypes)
      .values({
        id: randomUUID(),
        name,
        color,
      })
      .returning();

    publish({ type: "change" });
    return Response.json({ ok: true, agendaType: toAgendaType(row) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Não foi possível criar o tipo de evento." }, { status: 500 });
  }
}
