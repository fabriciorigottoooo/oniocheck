import type { activities, clients, collaborators } from "@/db/schema";
import type { Activity, ActivityAction, ClientT, Collab } from "./types";

type ClientRow = typeof clients.$inferSelect;
type CollabRow = typeof collaborators.$inferSelect;
type ActivityRow = typeof activities.$inferSelect;

export function toClient(r: ClientRow): ClientT {
  return {
    id: r.id,
    name: r.name,
    economicGroup: (r as typeof r & { economicGroup?: string | null }).economicGroup ?? null,
    attendanceUnit: (r as typeof r & { attendanceUnit?: string | null }).attendanceUnit ?? null,
    checks: Array.isArray(r.checks) ? r.checks : [],
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toCollab(r: CollabRow): Collab {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    createdAt: r.createdAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
  };
}

export function toActivity(r: ActivityRow): Activity {
  return {
    id: r.id,
    actorId: r.actorId,
    actorName: r.actorName,
    actorColor: r.actorColor,
    clientId: r.clientId,
    clientName: r.clientName,
    action: r.action as ActivityAction,
    detail: r.detail,
    createdAt: r.createdAt.toISOString(),
  };
}
