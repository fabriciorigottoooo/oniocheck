import type {
  ActorInput,
  AppState,
  ClientT,
  Collab,
  PatchBody,
} from "./types";

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const api = {
  state: () => req<AppState>("/api/state"),

  login: (body: { username: string; password: string }) =>
    req<{ user: { id: string; username: string; role: string }; collaborator: Collab }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),

  join: (body: { id?: string; name: string }) =>
    req<{ collaborator: Collab }>("/api/collaborators", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  heartbeat: (id: string) =>
    req<{ ok: boolean; collaborator?: Collab }>("/api/collaborators/heartbeat", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),

  updateProfile: (body: {
    id: string;
    username?: string;
    displayName?: string | null;
    password?: string;
    avatarUrl?: string | null;
  }) =>
    req<{ ok: boolean; collaborator: Collab }>("/api/auth/profile", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createClient: (body: {
    name: string;
    economicGroup?: string | null;
    attendanceUnit?: string | null;
    phone?: string | null;
    actor: ActorInput;
  }) =>
    req<{ client: ClientT }>("/api/clients", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  patchClient: (id: string, body: PatchBody) =>
    req<{ client: ClientT }>(`/api/clients/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteClient: (id: string, body: { actor: ActorInput }) =>
    req<{ ok: boolean; deletedId: string; client: ClientT }>(
      `/api/clients/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        body: JSON.stringify(body),
      },
    ),

  deleteCollaborator: (id: string) =>
    req<{ ok: boolean; deletedId: string }>(`/api/collaborators/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  createAgendaType: (body: { name: string; color: string; actor?: ActorInput }) =>
    req<{ ok: boolean; agendaType: { id: string; name: string; color: string; createdAt: string } }>(
      "/api/agenda/types",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),

  updateAgendaType: (id: string, body: { name: string; color: string; actor?: ActorInput }) =>
    req<{ ok: boolean; agendaType: { id: string; name: string; color: string; createdAt: string } }>(
      `/api/agenda/types/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    ),

  deleteAgendaType: (id: string, body?: { actor?: ActorInput }) =>
    req<{ ok: boolean; deletedId: string }>(`/api/agenda/types/${encodeURIComponent(id)}`, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    }),

  createAgendaEvent: (body: {
    title: string;
    typeId: string;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string | null;
    meetingUrl?: string | null;
    finished?: boolean;
    actor: ActorInput;
  }) =>
    req<{ ok: boolean; event: {
      id: string;
      title: string;
      typeId: string;
      typeName: string;
      typeColor: string;
      date: string;
      startTime: string;
      endTime: string;
      notes: string | null;
      meetingUrl: string | null;
      finishedAt: string | null;
      organizerId: string;
      organizerName: string;
      createdAt: string;
    } }>("/api/agenda/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateAgendaEvent: (id: string, body: {
    title: string;
    typeId: string;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string | null;
    meetingUrl?: string | null;
    finished?: boolean;
    actor: ActorInput;
  }) =>
    req<{ ok: boolean; event: {
      id: string;
      title: string;
      typeId: string;
      typeName: string;
      typeColor: string;
      date: string;
      startTime: string;
      endTime: string;
      notes: string | null;
      meetingUrl: string | null;
      finishedAt: string | null;
      organizerId: string;
      organizerName: string;
      createdAt: string;
    } }>(`/api/agenda/events/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteAgendaEvent: (id: string, body?: { actor?: ActorInput }) =>
    req<{ ok: boolean; deletedId: string }>(`/api/agenda/events/${encodeURIComponent(id)}`, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    }),

  importClients: (body: { payload: unknown; actor: ActorInput }) =>
    req<{ ok: boolean; count: number }>("/api/import", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
