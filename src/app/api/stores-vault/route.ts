import { and, eq } from "drizzle-orm";
import { db, ensureDatabaseCompatibility } from "@/db";
import { storesVault } from "@/db/schema";
import { publish } from "@/lib/bus";
import { resolveActor } from "@/lib/collab";
import type { StoresVaultEnvelope } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VAULT_ID = "shared";

export async function GET() {
  try {
    await ensureDatabaseCompatibility();
    const [row] = await db.select().from(storesVault).where(eq(storesVault.id, VAULT_ID)).limit(1);
    return Response.json({ vault: row?.payload ?? null, revision: row?.updatedAt.toISOString() ?? null });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível carregar o cofre compartilhado." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureDatabaseCompatibility();
    const body = (await req.json().catch(() => ({}))) as {
      vault?: Partial<StoresVaultEnvelope>;
      expectedUpdatedAt?: unknown;
      actor?: { id?: unknown; name?: unknown };
    };
    const actor = await resolveActor(body.actor ?? {});
    if (!actor) return Response.json({ error: "Identifique-se para salvar o cofre." }, { status: 400 });

    const vault = body.vault;
    if (
      vault?.version !== 1 ||
      typeof vault.salt !== "string" || vault.salt.length > 128 ||
      typeof vault.iv !== "string" || vault.iv.length > 128 ||
      typeof vault.data !== "string" || vault.data.length > 5_000_000
    ) {
      return Response.json({ error: "Conteúdo criptografado inválido." }, { status: 400 });
    }

    const payload = vault as StoresVaultEnvelope;
    const updatedAt = new Date();
    if (body.expectedUpdatedAt === null) {
      const [inserted] = await db.insert(storesVault)
        .values({ id: VAULT_ID, payload, updatedAt })
        .onConflictDoNothing()
        .returning();
      if (!inserted) {
        return Response.json({ error: "Outro membro da equipe já criou ou alterou o cofre. Atualize a tela antes de continuar." }, { status: 409 });
      }
    } else if (typeof body.expectedUpdatedAt === "string" && Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
      const [updated] = await db.update(storesVault)
        .set({ payload, updatedAt })
        .where(and(
          eq(storesVault.id, VAULT_ID),
          eq(storesVault.updatedAt, new Date(body.expectedUpdatedAt)),
        ))
        .returning();
      if (!updated) {
        return Response.json({ error: "Outro membro da equipe alterou o cofre. Os seus dados não foram gravados; atualize a tela e tente novamente." }, { status: 409 });
      }
    } else {
      return Response.json({ error: "Versão do cofre inválida. Atualize a tela e tente novamente." }, { status: 400 });
    }
    publish({ type: "change" });
    return Response.json({ ok: true, revision: updatedAt.toISOString() });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível salvar o cofre compartilhado." }, { status: 500 });
  }
}
