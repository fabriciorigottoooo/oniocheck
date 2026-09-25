export type DashboardClient = {
  id: string;
  name: string;
  attendanceUnit?: string | null;
  economicGroup?: string | null;
  finishedAt?: string | null;
  checks?: Array<{ done?: boolean | null } | null>;
};

export type DashboardStoreSummary = {
  name: string;
  total: number;
  active: number;
  done: number;
  progress: number;
  completion: number;
};

export type DashboardPriorityClient = {
  id: string;
  name: string;
  unit: string;
  progress: number;
};

export type DashboardSummary = {
  totalClients: number;
  activeClients: number;
  finishedClients: number;
  completionRate: number;
  storeSummary: DashboardStoreSummary[];
  bestStore: DashboardStoreSummary | null;
  priorityClients: DashboardPriorityClient[];
};

export function getClientProgress(client?: Partial<DashboardClient>): number;
export function summarizeDashboard(clients?: DashboardClient[]): DashboardSummary;
