import { and, eq } from "drizzle-orm";
import { db, ensureDatabaseCompatibility } from "@/db";
import { storeRegistry } from "@/db/schema";
import { publish } from "@/lib/bus";
import { resolveActor } from "@/lib/collab";
import type { StoreRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REGISTRY_ID = "shared";
const ROLES = new Set(["Atendente", "Administrador", "Suporte"]);

function isText(value: unknown, maxLength = 20_000): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isStoreRecord(value: unknown): value is StoreRecord {
  if (!value || typeof value !== "object") return false;
  const store = value as Partial<StoreRecord>;
  return isText(store.id, 100) && isText(store.name, 200) && !!store.name.trim() &&
    isText(store.cnpj, 100) && isText(store.phone, 100) &&
    isText(store.responsible, 200) && isText(store.observations) &&
    isText(store.createdAt, 100) && isText(store.updatedAt, 100) &&
    Array.isArray(store.accounts) && store.accounts.length <= 100 &&
    store.accounts.every((account) =>
      !!account && typeof account === "object" &&
      isText(account.id, 100) && ROLES.has(account.role) &&
      isText(account.email, 320) && isText(account.password, 2_000),
    );
}

export async function GET() {
  try {
    await ensureDatabaseCompatibility();
    const [row] = await db.select().from(storeRegistry).where(eq(storeRegistry.id, REGISTRY_ID)).limit(1);
    return Response.json({ stores: row?.payload ?? [], revision: row?.updatedAt.toISOString() ?? null });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível carregar os cadastros das lojas." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureDatabaseCompatibility();
    const body = (await req.json().catch(() => ({}))) as {
      stores?: unknown;
      expectedUpdatedAt?: unknown;
      actor?: { id?: unknown; name?: unknown };
    };
    const actor = await resolveActor(body.actor ?? {});
    if (!actor) return Response.json({ error: "Identifique-se para salvar os cadastros." }, { status: 400 });
    if (!Array.isArray(body.stores) || body.stores.length > 10_000 || !body.stores.every(isStoreRecord)) {
      return Response.json({ error: "Os dados dos cadastros são inválidos." }, { status: 400 });
    }

    const stores = body.stores;
    const payloadSize = Buffer.byteLength(JSON.stringify(stores), "utf8");
    if (payloadSize > 5_000_000) return Response.json({ error: "O conteúdo excede o limite permitido." }, { status: 413 });
    const updatedAt = new Date();

    if (body.expectedUpdatedAt === null) {
      const [inserted] = await db.insert(storeRegistry)
        .values({ id: REGISTRY_ID, payload: stores, updatedAt })
        .onConflictDoNothing()
        .returning();
      if (!inserted) {
        return Response.json({ error: "Outro membro já criou ou alterou os cadastros. Atualize a tela antes de continuar." }, { status: 409 });
      }
    } else if (typeof body.expectedUpdatedAt === "string" && Number.isFinite(Date.parse(body.expectedUpdatedAt))) {
      const [updated] = await db.update(storeRegistry)
        .set({ payload: stores, updatedAt })
        .where(and(
          eq(storeRegistry.id, REGISTRY_ID),
          eq(storeRegistry.updatedAt, new Date(body.expectedUpdatedAt)),
        ))
        .returning();
      if (!updated) {
        return Response.json({ error: "Outro membro alterou os cadastros. Os seus dados não foram gravados; atualize a tela e tente novamente." }, { status: 409 });
      }
    } else {
      return Response.json({ error: "Versão dos cadastros inválida. Atualize a tela e tente novamente." }, { status: 400 });
    }

    publish({ type: "change" });
    return Response.json({ ok: true, revision: updatedAt.toISOString() });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível salvar os cadastros das lojas." }, { status: 500 });
  }
}
