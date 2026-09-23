export type StepState = {
  done: boolean;
  by: string | null;
  at: string | null;
};

export type ClientT = {
  id: string;
  name: string;
  economicGroup?: string | null;
  attendanceUnit?: string | null;
  phone?: string | null;
  checks: StepState[];
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Collab = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
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
  | "deleted"
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

export type AgendaType = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

export type AgendaEvent = {
  id: string;
  title: string;
  typeId: string;
  typeName: string;
  typeColor: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  organizerId: string;
  organizerName: string;
  createdAt: string;
};

export type AppState = {
  clients: ClientT[];
  collaborators: Collab[];
  activities: Activity[];
  agendaTypes: AgendaType[];
  agendaEvents: AgendaEvent[];
  serverTime: string;
};

export type BusEvent =
  | { type: "change"; activity?: Activity }
  | { type: "presence" };

export type ActorInput = { id: string; name: string };

export type PatchBody =
  | {
      op: "rename";
      name: string;
      economicGroup?: string | null;
      attendanceUnit?: string | null;
      phone?: string | null;
      actor: ActorInput;
    }
  | { op: "step"; index: number; value: boolean; actor: ActorInput }
  | { op: "finish"; actor: ActorInput }
  | { op: "reopen"; actor: ActorInput };
