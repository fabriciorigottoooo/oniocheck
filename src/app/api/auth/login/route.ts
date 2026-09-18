import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { collaborators, users } from "@/db/schema";
import { publish } from "@/lib/bus";
import { toCollab } from "@/lib/mappers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const username = normalize((body as { username?: unknown })?.username).slice(0, 40);
    const password = normalize((body as { password?: unknown })?.password).slice(0, 50);

    if (!username || !password) {
      return Response.json({ error: "Informe nome de usuário e senha." }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    const userRow = existing[0]
      ? existing[0]
      : await db
          .insert(users)
          .values({
            id: randomUUID(),
            username,
            password,
            role: username.toLowerCase() === "admin" ? "admin" : "user",
            updatedAt: new Date(),
          })
          .returning()
          .then((rows) => rows[0]);

    if (!userRow) {
      return Response.json({ error: "Não foi possível criar o usuário." }, { status: 500 });
    }

    if (existing[0] && userRow.password !== password) {
      return Response.json({ error: "Senha incorreta." }, { status: 401 });
    }

    if (!existing[0]) {
      await db
        .update(users)
        .set({ updatedAt: new Date() })
        .where(eq(users.id, userRow.id));
    }

    let collaboratorRow = await db
      .select()
      .from(collaborators)
      .where(eq(collaborators.name, username))
      .limit(1);

    if (!collaboratorRow[0]) {
      const created = await db
        .insert(collaborators)
        .values({
          id: randomUUID(),
          name: username,
          color: "#2a9b81",
          lastSeenAt: new Date(),
        })
        .returning();
      collaboratorRow = created;
    } else {
      const [updatedCollaborator] = await db
        .update(collaborators)
        .set({ lastSeenAt: new Date() })
        .where(eq(collaborators.id, collaboratorRow[0].id))
        .returning();
      collaboratorRow = [updatedCollaborator ?? collaboratorRow[0]];
    }

    publish({ type: "presence" });

    return Response.json({
      user: {
        id: userRow.id,
        username: userRow.username,
        role: userRow.role,
      },
      collaborator: toCollab(collaboratorRow[0]),
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Erro interno do login." }, { status: 500 });
  }
}
