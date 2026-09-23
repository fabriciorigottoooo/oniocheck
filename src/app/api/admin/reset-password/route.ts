import { eq } from "drizzle-orm";
import { db, ensureDatabaseCompatibility } from "@/db";
import { collaborators, users } from "@/db/schema";
import { publish } from "@/lib/bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureDatabaseCompatibility();

    const body = (await req.json().catch(() => ({}))) as {
      collaboratorId?: unknown;
      password?: unknown;
      confirmPassword?: unknown;
    };

    const collaboratorId = typeof body.collaboratorId === "string" ? body.collaboratorId.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword.trim() : "";

    if (!collaboratorId) {
      return Response.json({ error: "Colaborador não informado." }, { status: 400 });
    }

    if (!password || !confirmPassword) {
      return Response.json({ error: "Informe a nova senha e confirme." }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return Response.json({ error: "As senhas digitadas não conferem." }, { status: 400 });
    }

    if (password.length < 4) {
      return Response.json({ error: "A nova senha deve ter pelo menos 4 caracteres." }, { status: 400 });
    }

    const collaboratorRows = await db
      .select()
      .from(collaborators)
      .where(eq(collaborators.id, collaboratorId))
      .limit(1);

    if (!collaboratorRows[0]) {
      return Response.json({ error: "Colaborador não encontrado." }, { status: 404 });
    }

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.username, collaboratorRows[0].name))
      .limit(1);

    if (!userRows[0]) {
      return Response.json({ error: "Usuário vinculada não encontrado para esse colaborador." }, { status: 404 });
    }

    await db
      .update(users)
      .set({ password, updatedAt: new Date() })
      .where(eq(users.id, userRows[0].id));

    publish({ type: "presence" });

    return Response.json({ ok: true, collaborator: collaboratorRows[0] });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Erro interno ao redefinir a senha." }, { status: 500 });
  }
}
