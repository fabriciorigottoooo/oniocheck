import { eq } from "drizzle-orm";
import { db, ensureDatabaseCompatibility } from "@/db";
import { collaborators } from "@/db/schema";
import { publish } from "@/lib/bus";
import { ONLINE_WINDOW_MS } from "@/lib/format";
import { toCollab } from "@/lib/mappers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureDatabaseCompatibility();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const id = (body as { id?: unknown })?.id;
    if (typeof id !== "string" || !id.trim()) {
      return Response.json({ error: "unknown_collaborator" }, { status: 404 });
    }
    const found = await db
      .select()
      .from(collaborators)
      .where(eq(collaborators.id, id))
      .limit(1);
    if (!found[0]) {
      return Response.json({ error: "unknown_collaborator" }, { status: 404 });
    }
    const wasOnline =
      Date.now() - found[0].lastSeenAt.getTime() < ONLINE_WINDOW_MS;
    const [updated] = await db
      .update(collaborators)
      .set({ lastSeenAt: new Date() })
      .where(eq(collaborators.id, id))
      .returning();
    if (!wasOnline) publish({ type: "presence" });
    return Response.json({ ok: true, collaborator: toCollab(updated ?? found[0]) });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
