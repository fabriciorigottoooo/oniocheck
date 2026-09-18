export type StepState = {
  done: boolean;
  by: string | null;
  at: string | null;
};

export type ClientT = {
  id: string;
  name: string;
  checks: StepState[];
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Collab = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  lastSeenAt: string;
};

export type ActivityAction =
  | "created"
  | "renamed"
  | "step_on"
  | "step_off"
  | "finished"
  | "reopened"
  | "imported";

export type Activity = {
  id: string;
  actorId: string;
  actorName: string;
  actorColor: string;
  clientId: string | null;
  clientName: string;
  action: ActivityAction;
  detail: string | null;
  createdAt: string;
};

export type AppState = {
  clients: ClientT[];
  collaborators: Collab[];
  activities: Activity[];
  serverTime: string;
};

export type BusEvent =
  | { type: "change"; activity?: Activity }
  | { type: "presence" };

export type ActorInput = { id: string; name: string };

export type PatchBody =
  | { op: "rename"; name: string; actor: ActorInput }
  | { op: "step"; index: number; value: boolean; actor: ActorInput }
  | { op: "finish"; actor: ActorInput }
  | { op: "reopen"; actor: ActorInput };
