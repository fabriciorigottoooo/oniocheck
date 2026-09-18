import { randomUUID } from "crypto";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { publish } from "@/lib/bus";
import { logActivity, resolveActor } from "@/lib/collab";
import { toClient } from "@/lib/mappers";
import { emptyChecks } from "@/lib/steps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Corpo inválido." }, { status: 400 });
    }
    const raw = body as { name?: unknown; actor?: unknown };
    const actor = await resolveActor(
      (raw?.actor as { id?: unknown; name?: unknown }) ?? {},
    );
    if (!actor) {
      return Response.json(
        { error: "Identifique-se para adicionar clientes." },
        { status: 400 },
      );
    }
    const name = typeof raw?.name === "string" ? raw.name.trim() : "";
    if (!name || name.length > 100) {
      return Response.json({ error: "Nome inválido." }, { status: 400 });
    }
    const [row] = await db
      .insert(clients)
      .values({ id: randomUUID(), name, checks: emptyChecks() })
      .returning();
    const activity = await logActivity({
      actor,
      clientId: row.id,
      clientName: row.name,
      action: "created",
    });
    publish({ type: "change", activity });
    return Response.json({ client: toClient(row) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
