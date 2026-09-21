import { eq } from "drizzle-orm";
import { db, ensureDatabaseCompatibility } from "@/db";
import { collaborators } from "@/db/schema";
import { publish } from "@/lib/bus";
import { toCollab } from "@/lib/mappers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureDatabaseCompatibility();
    const body = (await req.json().catch(() => ({}))) as {
      id?: unknown;
      username?: unknown;
      password?: unknown;
      avatarUrl?: unknown;
    };

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : "";

    if (!id) {
      return Response.json({ error: "Usuário inválido." }, { status: 400 });
    }

    const row = await db
      .select()
      .from(collaborators)
      .where(eq(collaborators.id, id))
      .limit(1);

    if (!row[0]) {
      return Response.json({ error: "Perfil não encontrado." }, { status: 404 });
    }

    const nextAvatar = avatarUrl || null;
    const [updated] = await db
      .update(collaborators)
      .set({
        avatarUrl: nextAvatar,
        lastSeenAt: new Date(),
      })
      .where(eq(collaborators.id, id))
      .returning();

    if (password) {
      const { users } = await import("@/db/schema");
      const usernameForPassword =
        typeof body.username === "string" && body.username.trim()
          ? body.username.trim()
          : row[0].name;
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.username, usernameForPassword))
        .limit(1);
      if (existing[0]) {
        await db
          .update(users)
          .set({ password, updatedAt: new Date() })
          .where(eq(users.id, existing[0].id));
      }
    }

    const fresh = updated ?? row[0];
    const collab = toCollab(fresh);
    publish({ type: "presence" });

    return Response.json({ ok: true, collaborator: collab });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Erro interno ao atualizar o perfil." }, { status: 500 });
  }
}
