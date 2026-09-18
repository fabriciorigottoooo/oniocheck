import { randomUUID } from "crypto";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, collaborators } from "@/db/schema";
import { publish } from "./bus";
import { toActivity, toCollab } from "./mappers";
import { pickColor } from "./palette";
import type { Activity, ActivityAction, Collab } from "./types";

/**
 * Resolves the collaborator behind a mutation. If the id is known, refreshes
 * presence and returns it; otherwise auto-registers (with a fresh color) so a
 * teammate keeps working even after a database reset.
 */
export async function resolveActor(input: {
  id?: unknown;
  name?: unknown;
}): Promise<Collab | null> {
  const id = typeof input?.id === "string" ? input.id.trim() : "";
  const name = typeof input?.name === "string" ? input.name.trim().slice(0, 40) : "";
  try {
    if (id) {
      const found = await db
        .select()
        .from(collaborators)
        .where(eq(collaborators.id, id))
        .limit(1);
      if (found[0]) {
        const [updated] = await db
          .update(collaborators)
          .set({ lastSeenAt: new Date() })
          .where(eq(collaborators.id, id))
          .returning();
        return toCollab(updated ?? found[0]);
      }
    }
    if (!name) return null;
    const [{ n }] = await db.select({ n: count() }).from(collaborators);
    const newId = id || randomUUID();
    await db
      .insert(collaborators)
      .values({ id: newId, name, color: pickColor(n), lastSeenAt: new Date() })
      .onConflictDoNothing();
    const created = await db
      .select()
      .from(collaborators)
      .where(eq(collaborators.id, newId))
      .limit(1);
    if (!created[0]) return null;
    publish({ type: "presence" });
    return toCollab(created[0]);
  } catch (e) {
    console.error("resolveActor failed", e);
    return null;
  }
}

export async function logActivity(a: {
  actor: Collab;
  clientId: string | null;
  clientName: string;
  action: ActivityAction;
  detail?: string | null;
}): Promise<Activity> {
  const rows = await db
    .insert(activities)
    .values({
      actorId: a.actor.id,
      actorName: a.actor.name,
      actorColor: a.actor.color,
      clientId: a.clientId,
      clientName: a.clientName,
      action: a.action,
      detail: a.detail ?? null,
    })
    .returning();
  return toActivity(rows[0]);
}
