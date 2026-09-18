import { eq } from "drizzle-orm";
import { db } from "@/db";
import { collaborators } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const target = await db
      .select()
      .from(collaborators)
      .where(eq(collaborators.id, id))
      .limit(1);

    if (!target[0]) {
      return Response.json({ error: "Colaborador não encontrado." }, { status: 404 });
    }

    await db.delete(collaborators).where(eq(collaborators.id, id));
    return Response.json({ ok: true, deletedId: id });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível excluir o colaborador." }, { status: 500 });
  }
}
