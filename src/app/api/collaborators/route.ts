import { randomUUID } from "crypto";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { collaborators } from "@/db/schema";
import { publish } from "@/lib/bus";
import { toCollab } from "@/lib/mappers";
import { pickColor } from "@/lib/palette";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const raw = body as { name?: unknown; id?: unknown };
    const name =
      typeof raw?.name === "string" ? raw.name.trim().slice(0, 40) : "";
    if (!name) {
      return Response.json({ error: "Digite um nome válido." }, { status: 400 });
    }
    const id =
      typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : null;
    const now = new Date();

    if (id) {
      const found = await db
        .select()
        .from(collaborators)
        .where(eq(collaborators.id, id))
        .limit(1);
      if (found[0]) {
        const [updated] = await db
          .update(collaborators)
          .set({ name, lastSeenAt: now })
          .where(eq(collaborators.id, id))
          .returning();
        publish({ type: "presence" });
        return Response.json({ collaborator: toCollab(updated ?? found[0]) });
      }
    }

    const [{ n }] = await db.select({ n: count() }).from(collaborators);
    const newId = id ?? randomUUID();
    await db
      .insert(collaborators)
      .values({ id: newId, name, color: pickColor(n), lastSeenAt: now })
      .onConflictDoNothing();
    const created = await db
      .select()
      .from(collaborators)
      .where(eq(collaborators.id, newId))
      .limit(1);
    if (!created[0]) {
      return Response.json(
        { error: "Não foi possível registrar o colaborador." },
        { status: 500 },
      );
    }
    publish({ type: "presence" });
    return Response.json({ collaborator: toCollab(created[0]) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
