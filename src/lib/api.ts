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

  createClient: (body: {
    name: string;
    economicGroup?: string | null;
    attendanceUnit?: string | null;
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

  deleteCollaborator: (id: string) =>
    req<{ ok: boolean; deletedId: string }>(`/api/collaborators/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  importClients: (body: { payload: unknown; actor: ActorInput }) =>
    req<{ ok: boolean; count: number }>("/api/import", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
