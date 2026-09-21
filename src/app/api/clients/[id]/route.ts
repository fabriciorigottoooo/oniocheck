import { eq } from "drizzle-orm";
import { db, ensureDatabaseCompatibility } from "@/db";
import { clients } from "@/db/schema";
import { publish } from "@/lib/bus";
import { logActivity, resolveActor } from "@/lib/collab";
import { toClient } from "@/lib/mappers";
import { STEPS } from "@/lib/steps";
import type { ActivityAction } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await ensureDatabaseCompatibility();
    const { id } = await ctx.params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Corpo inválido." }, { status: 400 });
    }

    const raw = body as {
      actor?: unknown;
    };
    const actor = await resolveActor(
      (raw?.actor as { id?: unknown; name?: unknown }) ?? {},
    );
    if (!actor) {
      return Response.json(
        { error: "Identifique-se para excluir um cliente finalizado." },
        { status: 400 },
      );
    }

    const rows = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    const target = rows[0];
    if (!target) {
      return Response.json({ error: "Cliente não encontrado." }, { status: 404 });
    }
    if (!target.finishedAt) {
      return Response.json(
        { error: "A exclusão só é permitida para clientes finalizados." },
        { status: 409 },
      );
    }

    const [deleted] = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning();

    const activity = await logActivity({
      actor,
      clientId: deleted.id,
      clientName: deleted.name,
      action: "deleted",
    });
    publish({ type: "change", activity });

    return Response.json({ ok: true, deletedId: deleted.id, client: toClient(deleted) });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await ensureDatabaseCompatibility();
    const { id } = await ctx.params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Corpo inválido." }, { status: 400 });
    }
    const raw = body as {
      op?: unknown;
      name?: unknown;
      economicGroup?: unknown;
      attendanceUnit?: unknown;
      index?: unknown;
      value?: unknown;
      actor?: unknown;
    };
    const actor = await resolveActor(
      (raw?.actor as { id?: unknown; name?: unknown }) ?? {},
    );
    if (!actor) {
      return Response.json(
        { error: "Identifique-se para alterar o checklist." },
        { status: 400 },
      );
    }
    const op = raw?.op;

    const result = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(clients)
        .where(eq(clients.id, id))
        .for("update");
      const c = rows[0];
      if (!c) return { kind: "missing" as const };
      const now = new Date();

      if (op === "rename") {
        const name = typeof raw.name === "string" ? raw.name.trim() : "";
        if (!name || name.length > 100) {
          return { kind: "bad" as const, error: "Nome inválido." };
        }
        const economicGroup =
          typeof raw.economicGroup === "string" ? raw.economicGroup.trim() : "";
        const attendanceUnit =
          typeof raw.attendanceUnit === "string" ? raw.attendanceUnit.trim() : "";

        const [updated] = await tx
          .update(clients)
          .set({
            name,
            economicGroup: economicGroup || null,
            attendanceUnit: attendanceUnit || null,
            updatedAt: now,
          })
          .where(eq(clients.id, id))
          .returning();
        return {
          kind: "ok" as const,
          client: updated,
          action: "renamed" as ActivityAction,
          detail: c.name,
        };
      }

      if (op === "step") {
        const index = Number(raw.index);
        const value = raw.value;
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index > 9 ||
          typeof value !== "boolean"
        ) {
          return { kind: "bad" as const, error: "Etapa inválida." };
        }
        if (c.finishedAt) {
          return {
            kind: "conflict" as const,
            error: "Este checklist já foi finalizado.",
          };
        }
        const next = c.checks.slice();
        while (next.length < 10) next.push({ done: false, by: null, at: null });
        next[index] = {
          done: value,
          by: value ? actor.name : null,
          at: value ? now.toISOString() : null,
        };
        const [updated] = await tx
          .update(clients)
          .set({ checks: next, updatedAt: now })
          .where(eq(clients.id, id))
          .returning();
        return {
          kind: "ok" as const,
          client: updated,
          action: (value ? "step_on" : "step_off") as ActivityAction,
          detail: STEPS[index] ?? null,
        };
      }

      if (op === "finish") {
        if (c.finishedAt) {
          return { kind: "conflict" as const, error: "Cliente já finalizado." };
        }
        if (!c.checks.every((s) => s?.done)) {
          return {
            kind: "conflict" as const,
            error: "Ainda há etapas pendentes.",
          };
        }
        const [updated] = await tx
          .update(clients)
          .set({ finishedAt: now, updatedAt: now })
          .where(eq(clients.id, id))
          .returning();
        return {
          kind: "ok" as const,
          client: updated,
          action: "finished" as ActivityAction,
          detail: null,
        };
      }

      if (op === "reopen") {
        if (!c.finishedAt) {
          return {
            kind: "conflict" as const,
            error: "Este checklist não está finalizado.",
          };
        }
        const [updated] = await tx
          .update(clients)
          .set({ finishedAt: null, updatedAt: now })
          .where(eq(clients.id, id))
          .returning();
        return {
          kind: "ok" as const,
          client: updated,
          action: "reopened" as ActivityAction,
          detail: null,
        };
      }

      return { kind: "bad" as const, error: "Operação desconhecida." };
    });

    if (result.kind === "missing") {
      return Response.json({ error: "Cliente não encontrado." }, { status: 404 });
    }
    if (result.kind === "bad") {
      return Response.json({ error: result.error }, { status: 400 });
    }
    if (result.kind === "conflict") {
      return Response.json({ error: result.error }, { status: 409 });
    }

    const activity = await logActivity({
      actor,
      clientId: id,
      clientName: result.client.name,
      action: result.action,
      detail: result.detail,
    });
    publish({ type: "change", activity });
    return Response.json({ client: toClient(result.client) });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
