import type { activities, agendaEventTypes, agendaEvents, clients, collaborators } from "@/db/schema";
import type { Activity, ActivityAction, AgendaEvent, AgendaType, ClientT, Collab } from "./types";

type ClientRow = typeof clients.$inferSelect;
type CollabRow = typeof collaborators.$inferSelect;
type ActivityRow = typeof activities.$inferSelect;
type AgendaTypeRow = typeof agendaEventTypes.$inferSelect;
type AgendaEventRow = typeof agendaEvents.$inferSelect;

export function toClient(r: ClientRow): ClientT {
  return {
    id: r.id,
    name: r.name,
    economicGroup: (r as typeof r & { economicGroup?: string | null }).economicGroup ?? null,
    attendanceUnit: (r as typeof r & { attendanceUnit?: string | null }).attendanceUnit ?? null,
    phone: (r as typeof r & { phone?: string | null }).phone ?? null,
    notes: (r as typeof r & { notes?: string | null }).notes ?? null,
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
    displayName: (r as typeof r & { displayName?: string | null }).displayName ?? null,
    color: r.color,
    avatarUrl: (r as typeof r & { avatarUrl?: string | null }).avatarUrl ?? null,
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

export function toAgendaType(r: AgendaTypeRow): AgendaType {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toAgendaEvent(r: AgendaEventRow): AgendaEvent {
  return {
    id: r.id,
    title: r.title,
    typeId: r.eventTypeId,
    typeName: r.eventTypeId,
    typeColor: "#2d6fe8",
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    notes: r.notes,
    meetingUrl: r.meetingUrl ?? null,
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    organizerId: r.organizerId,
    organizerName: r.organizerName,
    createdAt: r.createdAt.toISOString(),
  };
}
