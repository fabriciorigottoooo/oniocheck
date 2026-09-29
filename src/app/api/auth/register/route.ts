import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, ensureDatabaseCompatibility } from "@/db";
import { collaborators, users } from "@/db/schema";
import { publish } from "@/lib/bus";
import { toCollab } from "@/lib/mappers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const normalize = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function POST(req: Request) {
  try {
    await ensureDatabaseCompatibility();
    const body = await req.json().catch(() => ({})) as {
      email?: unknown;
      username?: unknown;
      password?: unknown;
      confirmPassword?: unknown;
    };
    const email = normalize(body.email).toLowerCase();
    const username = normalize(body.username).slice(0, 40);
    const password = normalize(body.password).slice(0, 256);
    const confirmPassword = normalize(body.confirmPassword).slice(0, 256);

    if (!email || !username || !password || !confirmPassword) {
      return Response.json({ error: "Preencha todos os campos para criar sua conta." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return Response.json({ error: "As senhas digitadas não conferem." }, { status: 400 });
    }

    const [sameUsername, sameEmail] = await Promise.all([
      db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1),
      db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1),
    ]);
    if (sameUsername[0]) {
      return Response.json({ error: "Esse nome de usuário já está em uso." }, { status: 409 });
    }
    if (sameEmail[0]) {
      return Response.json({ error: "Já existe uma conta com esse e-mail." }, { status: 409 });
    }

    const result = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        id: randomUUID(), username, email, password, role: "user", updatedAt: new Date(),
      }).returning();

      const [existingCollaborator] = await tx.select().from(collaborators)
        .where(eq(collaborators.name, username)).limit(1);
      const [collaborator] = existingCollaborator
        ? await tx.update(collaborators)
            .set({ lastSeenAt: new Date() })
            .where(eq(collaborators.id, existingCollaborator.id))
            .returning()
        : await tx.insert(collaborators).values({
            id: randomUUID(), name: username, color: "#2a9b81", lastSeenAt: new Date(),
          }).returning();

      return { user, collaborator };
    });

    publish({ type: "presence" });
    return Response.json({
      user: { id: result.user.id, username: result.user.username, role: result.user.role },
      collaborator: toCollab(result.collaborator),
    }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return Response.json({ error: "Esse e-mail ou nome de usuário já está em uso." }, { status: 409 });
    }
    console.error(error);
    return Response.json({ error: "Não foi possível criar sua conta agora." }, { status: 500 });
  }
}
