"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogOut,
  Menu as MenuIcon,
  ListFilter,
  Maximize2,
  Minimize2,
  MoonStar,
  NotebookPen,
  PencilLine,
  Plus,
  SlidersHorizontal,
  RotateCcw,
  Settings,
  SunMedium,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { summarizeDashboard } from "@/lib/dashboard";
import {
  activityParts,
  isOnline,
  norm,
  relTime,
} from "@/lib/format";
import {
  WORKFLOW_FILTERS,
  getWorkflowProgress,
  isWorkflowFilterPending,
  normalizeWorkflow,
  isWorkflowComplete,
  updateWorkflow,
  type WorkflowUpdate,
} from "@/lib/workflow";
import type { Activity, AgendaEvent, AgendaType, AppState, ClientT, Collab } from "@/lib/types";
import Sidebar from "./Sidebar";
import ClientList from "./ClientList";
import ClientDetail from "./ClientDetail";
import {
  ActivityModal,
  AdminDialog,
  AgendaEventDialog,
  AgendaTypeDialog,
  AuthDialog,
  ClientDialog,
  ClientNotesDialog,
  CollaboratorDetailDialog,
  ProfileDialog,
  TeamModal,
} from "./Dialogs";
import Toasts, { type ToastItem } from "./Toasts";
import Avatar from "./Avatar";
import StoresView from "./StoresView";

const ME_KEY = "oniocheck-me-v1";
const LAST_SEEN_ACTIVITY_KEY = "oniocheck-last-seen-activity-v1";
const CLIENT_BACKUP_KEY = "oniocheck-client-backup-v1";
const DELETED_CLIENTS_KEY = "oniocheck-deleted-clients-v1";

const clientWorkflow = (client: ClientT) => client.workflow ?? normalizeWorkflow(null, client.checks, client.finishedAt);

type Me = {
  id: string;
  name: string;
  displayName?: string | null;
  color: string;
  username: string;
  role: string;
};

let toastSeq = 1;

export default function App() {
  const [data, setData] = useState<AppState>({
    clients: [],
    collaborators: [],
    activities: [],
    agendaTypes: [],
    agendaEvents: [],
    serverTime: new Date().toISOString(),
  });
  const [me, setMe] = useState<Me | null>(null);
  const [needSetup, setNeedSetup] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [live, setLive] = useState(false);
  const [view, setView] = useState<"active" | "done">("active");
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [storesOpen, setStoresOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clientListCollapsed, setClientListCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [clientDialog, setClientDialog] = useState<
    { mode: "new" } | { mode: "rename"; client: ClientT } | null
  >(null);
  const [notesFor, setNotesFor] = useState<ClientT | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [dashboardChartExpanded, setDashboardChartExpanded] = useState(false);
  const [hiddenChartSeries, setHiddenChartSeries] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [deletedClientIds, setDeletedClientIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(DELETED_CLIENTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [teamOpen, setTeamOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityAlert, setActivityAlert] = useState(false);
  const [selectedStepFilters, setSelectedStepFilters] = useState<string[]>([]);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);
  const [agendaTypeDialog, setAgendaTypeDialog] = useState<
    | null
    | { mode: "create"; name: string; color: string }
    | { mode: "edit"; type: AgendaType }
  >(null);
  const [agendaEventDialog, setAgendaEventDialog] = useState<
    | null
    | { mode: "edit"; event: AgendaEvent }
  >(null);
  const [agendaForm, setAgendaForm] = useState({
    title: "",
    typeId: "",
    date: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
    finished: false,
  });
  const [saving, setSaving] = useState(false);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const fileRef = useRef<HTMLInputElement>(null);
  const topMenuRef = useRef<HTMLDivElement>(null);
  const chartPlotRef = useRef<HTMLDivElement>(null);
  const chartDragRef = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meRef = useRef<Me | null>(null);
  const activityOpenRef = useRef(activityOpen);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    activityOpenRef.current = activityOpen;
  }, [activityOpen]);

  useEffect(() => {
    if (!topMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !topMenuRef.current?.contains(event.target)) {
        setTopMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTopMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [topMenuOpen]);

  useEffect(() => {
    if (!dashboardChartExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDashboardChartExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dashboardChartExpanded]);

  /* ---------- helpers ---------- */

  const pushToast = useCallback((text: string, color?: string) => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-2), { id, text, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const errMsg = (e: unknown, fallback: string) =>
    e instanceof Error && e.message ? e.message : fallback;

  const normalizeAgendaTimeWindow = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return { startTime, endTime };
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    if (endTotal <= startTotal) {
      return { startTime, endTime: addOneHour(startTime) };
    }
    return { startTime, endTime };
  };

  const addOneHour = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    start.setHours(start.getHours() + 1);
    return `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  };

  const fetchState = useCallback(async () => {
    try {
      const s = await api.state();
      for (const a of s.activities) seenRef.current.add(a.id);

      try {
        const raw = localStorage.getItem(CLIENT_BACKUP_KEY);
        if (raw && s.clients.length === 0) {
          const backup = JSON.parse(raw) as Partial<AppState>;
          if (Array.isArray(backup.clients) && backup.clients.length) {
            setData({ ...s, clients: backup.clients as ClientT[] });
            return;
          }
        }
      } catch {
        // backup local inválido; ignora e mantém o servidor
      }

      setData(s);
      const newestActivityId = s.activities[0]?.id ?? null;
      try {
        const savedLastSeen = localStorage.getItem(LAST_SEEN_ACTIVITY_KEY);
        if (savedLastSeen === null) {
          // Na primeira visita, considera o histórico atual como já conhecido.
          localStorage.setItem(LAST_SEEN_ACTIVITY_KEY, newestActivityId ?? "");
        } else if (newestActivityId && newestActivityId !== savedLastSeen) {
          if (activityOpenRef.current) {
            localStorage.setItem(LAST_SEEN_ACTIVITY_KEY, newestActivityId);
            setActivityAlert(false);
          } else {
            setActivityAlert(true);
          }
        }
      } catch {
        // Se o navegador bloquear o armazenamento, mantém o indicador em memória.
      }
      try {
        localStorage.setItem(CLIENT_BACKUP_KEY, JSON.stringify(s));
      } catch {
        // sem armazenamento disponível
      }
    } catch {
      // mantém dados anteriores; o indicador de conexão avisa
    } finally {
      setInitialDataLoaded(true);
    }
  }, []);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      void fetchState();
    }, 150);
  }, [fetchState]);

  const handleToggleActivity = useCallback(() => {
    setActivityOpen((value) => {
      const next = !value;
      if (next) {
        setActivityAlert(false);
        try {
          localStorage.setItem(LAST_SEEN_ACTIVITY_KEY, data.activities[0]?.id ?? "");
        } catch {
          // O histórico continua marcado como lido nesta sessão.
        }
      }
      return next;
    });
  }, [data.activities]);

  const replaceClient = useCallback((fresh: ClientT) => {
    setData((prev) =>
      prev
        ? { ...prev, clients: prev.clients.map((x) => (x.id === fresh.id ? fresh : x)) }
        : prev,
    );
  }, []);

  /* ---------- bootstrap ---------- */

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const raw = localStorage.getItem(ME_KEY);
        if (raw) {
          const p = JSON.parse(raw) as Partial<Me>;
          if (p && typeof p.id === "string" && typeof p.name === "string" && p.name) {
            const nextMe = {
              id: p.id,
              name: p.name,
              color: p.color ?? "#2a9b81",
              username: p.username ?? p.name,
              role: p.role ?? "user",
            };
            setMe(nextMe);
            void fetchState();
            return;
          }
        }
      } catch {
        // identidade corrompida -> pede novamente
      }

      // Não bloqueia a tela de login enquanto o servidor responde.
      // O estado pode continuar carregando em background sem travar a UI.
      setNeedSetup(true);
      void fetchState();
    };

    void bootstrap();
  }, [fetchState]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const storedTheme = localStorage.getItem("oniocheck-theme");
    if (storedTheme === "dark") setDarkMode(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("oniocheck-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(DELETED_CLIENTS_KEY, JSON.stringify(deletedClientIds));
    } catch {
      // sem armazenamento disponível
    }
  }, [deletedClientIds]);

  /* ---------- realtime: SSE + heartbeat + poll ---------- */

  useEffect(() => {
    if (!me) return;

    const es = new EventSource("/api/events");
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (ev) => {
      try {
        const evt = JSON.parse(ev.data) as {
          type?: string;
          activity?: Activity;
        };
        if (evt.type === "change" || evt.type === "presence") {
          scheduleRefetch();
        }
        const a = evt.activity;
        if (a && a.actorId !== me.id && !seenRef.current.has(a.id)) {
          seenRef.current.add(a.id);
          const { actor, msg } = activityParts(a);
          pushToast(`${actor} ${msg}`, a.actorColor);
        }
      } catch {
        // pacote inválido — ignora
      }
    };

    const beat = () => {
      api.heartbeat(me.id).catch(async (e) => {
        if (errMsg(e, "").includes("unknown")) {
          try {
            await api.join({ id: me.id, name: me.name });
          } catch {
            // tenta de novo no próximo heartbeat
          }
        }
      });
    };
    beat();
    const hb = setInterval(beat, 10_000);
    const poll = setInterval(() => void fetchState(), 25_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void fetchState();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      es.close();
      clearInterval(hb);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [me, fetchState, scheduleRefetch, pushToast]);

  /* ---------- derived ---------- */

  const clients = data?.clients;
  const collaborators = data?.collaborators ?? [];
  const activities = data?.activities ?? [];
  const agendaTypes = data?.agendaTypes ?? [];
  const agendaEvents = data?.agendaEvents ?? [];
  const meAvatarUrl = collaborators.find((c) => c.id === me?.id)?.avatarUrl ?? null;

  const filteredClients = useMemo(
    () => (clients ?? []).filter((c) => !deletedClientIds.includes(c.id)),
    [clients, deletedClientIds],
  );

  const activeClients = useMemo(
    () => filteredClients.filter((c) => !c.finishedAt),
    [filteredClients],
  );
  const doneClients = useMemo(
    () =>
      filteredClients
        .filter((c) => c.finishedAt)
        .slice()
        .sort(
          (a, b) =>
            Date.parse(b.finishedAt as string) - Date.parse(a.finishedAt as string),
        ),
    [filteredClients],
  );
  const filteredStepClients = useMemo(() => {
    if (!selectedStepFilters.length) return activeClients;
    return activeClients.filter((client) =>
      selectedStepFilters.some((filterId) => isWorkflowFilterPending(clientWorkflow(client), filterId)),
    );
  }, [activeClients, selectedStepFilters]);

  const visible = useMemo(() => {
    const q = norm(search.trim());
    const baseList = view === "active"
      ? (selectedStepFilters.length === 0 ? activeClients : filteredStepClients)
      : doneClients;
    return q ? baseList.filter((c) => norm(c.name).includes(q)) : baseList;
  }, [view, search, activeClients, doneClients, filteredStepClients, selectedStepFilters]);

  const selected =
    filteredClients.find((c) => c.id === selectedId) ??
    visible[0] ??
    null;
  const onlineCollabs = collaborators.filter((c) => isOnline(c, now));
  const stepsDone = activeClients.reduce((n, client) => n + getWorkflowProgress(clientWorkflow(client)).done, 0);
  const totalSteps = activeClients.reduce((n, client) => n + getWorkflowProgress(clientWorkflow(client)).total, 0);
  const selectedCollaborator =
    collaborators.find((c) => c.id === selectedCollaboratorId) ?? null;
  const dashboardSummary = useMemo(() => summarizeDashboard(filteredClients), [filteredClients]);
  const stepBreakdown = useMemo(
    () =>
      WORKFLOW_FILTERS.map((step, index) => {
        const done = activeClients.filter((client) => !isWorkflowFilterPending(clientWorkflow(client), step.id)).length;
        const missing = activeClients.length - done;
        return {
          label: step.label,
          id: step.id,
          index,
          done,
          missing,
          progress: activeClients.length ? Math.round((done / activeClients.length) * 100) : 0,
        };
      }),
    [activeClients],
  );
  const doneStepBreakdown = useMemo(() => WORKFLOW_FILTERS.map((step, index) => {
    const completed = doneClients.filter((client) => !isWorkflowFilterPending(clientWorkflow(client), step.id)).length;
    return {
      label: step.label,
      id: step.id,
      index,
      done: completed,
      missing: doneClients.length - completed,
      progress: doneClients.length ? Math.round((completed / doneClients.length) * 100) : 0,
    };
  }), [doneClients]);
  const lineChartSteps = stepBreakdown;
  const chartViewWidth = dashboardChartExpanded ? 1480 : 850;
  const chartX = (index: number) => 56 + index * ((chartViewWidth - 112) / Math.max(lineChartSteps.length - 1, 1));
  const chartPlotHeight = dashboardChartExpanded ? 340 : 156;
  const chartViewHeight = dashboardChartExpanded ? 430 : 280;
  const chartLabelY = dashboardChartExpanded ? 408 : 218;
  const chartY = (value: number) => 28 + ((100 - value) / 100) * chartPlotHeight;
  const activeAverage = totalSteps
    ? Math.round((stepsDone / totalSteps) * 100)
    : 0;
  const chartSeries = [
    ...(activeClients.length ? [
      { key: "active-done", label: "Em andamento · concluídas", color: "#2878e8", values: stepBreakdown.map((step) => step.progress), counts: stepBreakdown.map((step) => step.done), total: activeClients.length },
      { key: "active-pending", label: "Em andamento · pendentes", color: "#f0a331", values: stepBreakdown.map((step) => 100 - step.progress), counts: stepBreakdown.map((step) => step.missing), total: activeClients.length },
    ] : []),
    ...(doneClients.length ? [
      { key: "done-complete", label: "Finalizadas · concluídas", color: "#21a47b", values: doneStepBreakdown.map((step) => step.progress), counts: doneStepBreakdown.map((step) => step.done), total: doneClients.length },
      { key: "done-pending", label: "Finalizadas · pendentes", color: "#d65c72", values: doneStepBreakdown.map((step) => 100 - step.progress), counts: doneStepBreakdown.map((step) => step.missing), total: doneClients.length },
    ] : []),
    ...(activeClients.length ? [{
      key: "active-average",
      label: "Média geral · em andamento",
      color: "#9366dc",
      values: lineChartSteps.map(() => activeAverage),
      counts: lineChartSteps.map(() => stepsDone),
      total: totalSteps,
      dashed: true,
    }] : []),
  ];
  const visibleChartSeries = chartSeries.filter((series) => !hiddenChartSeries.includes(series.key));
  const agendaTypeMap = useMemo(
    () => new Map(agendaTypes.map((t) => [t.id, t])),
    [agendaTypes],
  );
  const upcomingEvents = useMemo(
    () =>
      [...agendaEvents].sort((a, b) => {
        const left = `${a.date}T${a.startTime}`;
        const right = `${b.date}T${b.startTime}`;
        return left.localeCompare(right);
      }),
    [agendaEvents],
  );

  /* ---------- actions ---------- */

  const changeView = (v: "active" | "done") => {
    setDashboardChartExpanded(false);
    setView(v);
    setDashboardOpen(false);
    setStoresOpen(false);
    setAgendaOpen(false);
    setSearch("");
    setSelectedId(null);
    setSelectedCollaboratorId(null);
    setSelectedStepFilters([]);
    setAdvancedFiltersOpen(false);
  };

  const openDashboard = () => {
    setDashboardChartExpanded(false);
    setDashboardOpen(true);
    setStoresOpen(false);
    setAgendaOpen(false);
    setSelectedCollaboratorId(null);
    setSelectedId(null);
    setSearch("");
  };

  const openAgenda = () => {
    setDashboardChartExpanded(false);
    setDashboardOpen(false);
    setStoresOpen(false);
    setAgendaOpen(true);
    setSelectedCollaboratorId(null);
    setSelectedId(null);
    setSearch("");
  };

  const openStores = () => {
    setDashboardChartExpanded(false);
    setDashboardOpen(false);
    setAgendaOpen(false);
    setStoresOpen(true);
    setSelectedCollaboratorId(null);
    setSelectedId(null);
    setSearch("");
  };

  useEffect(() => {
    if (!agendaOpen || !agendaTypes.length || agendaForm.typeId) return;
    setAgendaForm((prev) => ({ ...prev, typeId: agendaTypes[0].id }));
  }, [agendaOpen, agendaForm.typeId, agendaTypes]);

  const createAgendaType = async (payload?: { name?: string; color?: string }) => {
    const name = (payload?.name ?? (agendaTypeDialog?.mode === "create" ? agendaTypeDialog.name : ""))
      .trim();
    const color = payload?.color ?? (agendaTypeDialog?.mode === "create" ? agendaTypeDialog.color : "#2d6fe8");
    if (!name || !me) return;
    setSaving(true);
    try {
      const { agendaType } = await api.createAgendaType({
        name,
        color,
        actor: { id: me.id, name: me.name },
      });
      setAgendaTypeDialog(null);
      setAgendaForm((prev) => ({ ...prev, typeId: prev.typeId || agendaType.id }));
      await fetchState();
      pushToast("Tipo de evento adicionado.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível criar o tipo de evento."));
    } finally {
      setSaving(false);
    }
  };

  const updateAgendaType = async (id: string, name: string, color: string) => {
    if (!me) return;
    setSaving(true);
    try {
      await api.updateAgendaType(id, {
        name: name.trim(),
        color,
        actor: { id: me.id, name: me.name },
      });
      setAgendaTypeDialog(null);
      await fetchState();
      pushToast("Tipo de evento atualizado.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível atualizar o tipo de evento."));
    } finally {
      setSaving(false);
    }
  };

  const deleteAgendaType = async (type: AgendaType) => {
    if (!me) return;
    const confirmed = window.confirm(`Excluir o tipo “${type.name}”? Eventos existentes continuam visíveis, mas este tipo deixará de aparecer no selector.`);
    if (!confirmed) return;
    setData((prev) => ({
      ...prev,
      agendaTypes: prev.agendaTypes.filter((item) => item.id !== type.id),
    }));
    setAgendaForm((prev) => ({ ...prev, typeId: prev.typeId === type.id ? "" : prev.typeId }));
    setSaving(true);
    try {
      await api.deleteAgendaType(type.id, { actor: { id: me.id, name: me.name } });
      await fetchState();
      pushToast("Tipo de evento removido.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível excluir o tipo de evento."));
    } finally {
      setSaving(false);
    }
  };

  const updateAgendaEvent = async (eventId: string, payload: {
    title: string;
    typeId: string;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string | null;
    finished?: boolean;
  }) => {
    if (!me) return;
    const normalized = normalizeAgendaTimeWindow(payload.startTime, payload.endTime);
    setSaving(true);
    try {
      await api.updateAgendaEvent(eventId, {
        title: payload.title.trim(),
        typeId: payload.typeId,
        date: payload.date,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        notes: payload.notes?.trim() || null,
        meetingUrl: null,
        finished: !!payload.finished,
        actor: { id: me.id, name: me.name },
      });
      setAgendaEventDialog(null);
      await fetchState();
      pushToast("Evento atualizado.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível atualizar o evento."));
    } finally {
      setSaving(false);
    }
  };

  const deleteAgendaEvent = async (event: AgendaEvent) => {
    if (!me) return;
    const confirmed = window.confirm(`Excluir o evento “${event.title}”?`);
    if (!confirmed) return;
    setData((prev) => ({
      ...prev,
      agendaEvents: prev.agendaEvents.filter((item) => item.id !== event.id),
    }));
    setAgendaEventDialog(null);
    setSaving(true);
    try {
      await api.deleteAgendaEvent(event.id, { actor: { id: me.id, name: me.name } });
      await fetchState();
      pushToast("Evento removido.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível excluir o evento."));
    } finally {
      setSaving(false);
    }
  };

  const toggleAgendaEventStatus = async (event: AgendaEvent) => {
    if (!me) return;
    const nextFinished = !event.finishedAt;
    setSaving(true);
    try {
      await api.updateAgendaEvent(event.id, {
        title: event.title,
        typeId: event.typeId,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        notes: event.notes,
        meetingUrl: null,
        finished: nextFinished,
        actor: { id: me.id, name: me.name },
      });
      await fetchState();
      pushToast(nextFinished ? "Evento marcado como finalizado." : "Evento reaberto.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível atualizar o status do evento."));
    } finally {
      setSaving(false);
    }
  };

  const createAgendaEvent = async () => {
    if (!me) return;
    const cleaned = agendaForm.title.trim();
    const typeId = agendaForm.typeId || agendaTypes[0]?.id;
    if (!cleaned || !typeId || !agendaForm.date || !agendaForm.startTime || !agendaForm.endTime) {
      pushToast("Preencha título, tipo, dia e horário.");
      return;
    }
    const normalized = normalizeAgendaTimeWindow(agendaForm.startTime, agendaForm.endTime);
    setSaving(true);
    try {
      await api.createAgendaEvent({
        title: cleaned,
        typeId,
        date: agendaForm.date,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        notes: agendaForm.notes.trim() || null,
        meetingUrl: null,
        finished: agendaForm.finished,
        actor: { id: me.id, name: me.name },
      });
      setAgendaForm({
        title: "",
        typeId: agendaTypes[0]?.id ?? "",
        date: new Date().toISOString().slice(0, 10),
        startTime: "09:00",
        endTime: "10:00",
        notes: "",
        finished: false,
      });
      await fetchState();
      pushToast("Evento agendado com sucesso.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível agendar o evento."));
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = async ({
    password,
    displayName,
    avatarUrl,
  }: {
    password?: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  }) => {
    const meNow = meRef.current;
    if (!meNow) return;
    setSaving(true);
    try {
      const { collaborator } = await api.updateProfile({
        id: meNow.id,
        username: meNow.username,
        displayName: displayName !== undefined ? (displayName?.trim() ? displayName.trim() : null) : undefined,
        password: password && password.trim() ? password.trim() : undefined,
        avatarUrl: avatarUrl && avatarUrl.trim() ? avatarUrl.trim() : null,
      });
      const safeDisplayName = collaborator.displayName?.trim() ? collaborator.displayName.trim() : collaborator.name;
      const nextMe = {
        ...meNow,
        name: safeDisplayName,
        displayName: collaborator.displayName?.trim() ? collaborator.displayName.trim() : null,
        color: collaborator.color,
      };
      setMe(nextMe);
      try {
        localStorage.setItem(ME_KEY, JSON.stringify(nextMe));
      } catch {
        // sem armazenamento disponível
      }
      await fetchState();
      setProfileOpen(false);
      pushToast("Perfil atualizado.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível atualizar o perfil."));
    } finally {
      setSaving(false);
    }
  };

  const login = async (username: string, password: string): Promise<string | null> => {
    setSaving(true);
    try {
      const { user, collaborator } = await api.login({ username, password });
      const next: Me = {
        id: collaborator.id,
        name: collaborator.displayName?.trim() ? collaborator.displayName.trim() : collaborator.name,
        displayName: collaborator.displayName?.trim() ? collaborator.displayName.trim() : null,
        color: collaborator.color,
        username: user.username,
        role: user.role,
      };
      try {
        localStorage.setItem(ME_KEY, JSON.stringify(next));
      } catch {
        // armazenamento indisponível — sessão ainda funciona
      }
      setMe(next);
      setNeedSetup(false);
      pushToast(`Bem-vindo(a), ${user.username}!`);
      void fetchState();
      return null;
    } catch (e) {
      const msg = errMsg(e, "Não foi possível entrar. Verifique usuário e senha.");
      return msg === "Senha incorreta." ? "Senha incorreta. Verifique seus dados." : msg;
    } finally {
      setSaving(false);
    }
  };

  const register = async (payload: { email: string; username: string; password: string; confirmPassword: string }): Promise<string | null> => {
    setSaving(true);
    try {
      const { user, collaborator } = await api.register(payload);
      const next: Me = {
        id: collaborator.id,
        name: collaborator.displayName?.trim() ? collaborator.displayName.trim() : collaborator.name,
        displayName: collaborator.displayName?.trim() ? collaborator.displayName.trim() : null,
        color: collaborator.color,
        username: user.username,
        role: user.role,
      };
      try {
        localStorage.setItem(ME_KEY, JSON.stringify(next));
      } catch {
        // armazenamento indisponível — sessão ainda funciona
      }
      setMe(next);
      setNeedSetup(false);
      pushToast(`Conta criada. Bem-vindo(a), ${user.username}!`);
      void fetchState();
      return null;
    } catch (e) {
      return errMsg(e, "Não foi possível criar sua conta agora.");
    } finally {
      setSaving(false);
    }
  };

  const createClient = async ({
    name,
    economicGroup,
    attendanceUnit,
    attendanceUnits,
    phone,
  }: {
    name: string;
    economicGroup?: string | null;
    attendanceUnit?: string | null;
    attendanceUnits?: string[] | null;
    phone?: string | null;
  }) => {
    const meNow = meRef.current;
    if (!meNow) return;
    setSaving(true);
    try {
      const { client } = await api.createClient({
        name,
        economicGroup,
        attendanceUnit,
        attendanceUnits,
        phone,
        actor: { id: meNow.id, name: meNow.name },
      });
      setData((prev) => {
        const next = prev ? { ...prev, clients: [...prev.clients, client] } : prev;
        if (next) {
          try {
            localStorage.setItem(CLIENT_BACKUP_KEY, JSON.stringify(next));
          } catch {
            // sem armazenamento disponível
          }
        }
        return next;
      });
      setView("active");
      setSearch("");
      setSelectedId(client.id);
      setClientDialog(null);
      pushToast("Cliente adicionado. A equipe já pode ver.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível adicionar o cliente."));
    } finally {
      setSaving(false);
    }
  };

  const renameClient = async ({
    name,
    economicGroup,
    attendanceUnit,
    attendanceUnits,
    phone,
    notes,
  }: {
    name: string;
    economicGroup?: string | null;
    attendanceUnit?: string | null;
    attendanceUnits?: string[] | null;
    phone?: string | null;
    notes?: string | null;
  }) => {
    const meNow = meRef.current;
    if (!meNow || !clientDialog || clientDialog.mode !== "rename") return;
    const target = clientDialog.client;
    setSaving(true);
    try {
      const { client } = await api.patchClient(target.id, {
        op: "rename",
        name,
        economicGroup,
        attendanceUnit,
        attendanceUnits,
        phone,
        notes,
        actor: { id: meNow.id, name: meNow.name },
      });
      replaceClient(client);
      try {
        const snapshot = data ?? { clients: [], collaborators: [], activities: [], serverTime: new Date().toISOString() };
        const next = { ...snapshot, clients: snapshot.clients.map((x) => (x.id === client.id ? client : x)) };
        localStorage.setItem(CLIENT_BACKUP_KEY, JSON.stringify(next));
      } catch {
        // sem armazenamento disponível
      }
      setClientDialog(null);
      pushToast("Dados do cliente atualizados.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível renomear."));
      void fetchState();
    } finally {
      setSaving(false);
    }
  };

  const saveClientNotes = async (notes: string) => {
    const meNow = meRef.current;
    if (!meNow || !notesFor) return;
    const target = notesFor;
    setSaving(true);
    try {
      const { client } = await api.patchClient(target.id, {
        op: "rename",
        name: target.name,
          economicGroup: target.economicGroup ?? null,
          attendanceUnit: target.attendanceUnit ?? null,
          attendanceUnits: target.attendanceUnits ?? (target.attendanceUnit ? [target.attendanceUnit] : []),
        phone: target.phone ?? null,
        notes: notes || null,
        actor: { id: meNow.id, name: meNow.name },
      });
      replaceClient(client);
      try {
        const snapshot = data ?? { clients: [], collaborators: [], activities: [], agendaTypes: [], agendaEvents: [], serverTime: new Date().toISOString() };
        const next = { ...snapshot, clients: snapshot.clients.map((x) => (x.id === client.id ? client : x)) };
        localStorage.setItem(CLIENT_BACKUP_KEY, JSON.stringify(next));
      } catch {
        // sem armazenamento disponível
      }
      setNotesFor(null);
      pushToast("Observações salvas.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível salvar as observações."));
      void fetchState();
    } finally {
      setSaving(false);
    }
  };

  const updateClientWorkflow = async (client: ClientT, workflowUpdate: WorkflowUpdate) => {
    const meNow = meRef.current;
    if (!meNow || client.finishedAt) return;
    const originalClient = client;
    const nowIso = new Date().toISOString();
    let optimisticClient: ClientT;
    try {
      const workflow = updateWorkflow(clientWorkflow(client), workflowUpdate, meNow.name, nowIso);
      optimisticClient = {
        ...client,
        workflow,
        finishedAt: isWorkflowComplete(workflow) ? nowIso : client.finishedAt,
      };
      replaceClient(optimisticClient);
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível atualizar esta etapa."));
      return;
    }
    setWorkflowSaving(true);
    try {
      const { client: fresh } = await api.patchClient(client.id, {
        op: "workflow",
        workflowUpdate,
        actor: { id: meNow.id, name: meNow.name },
      });
      replaceClient(fresh);
      if (fresh.finishedAt) {
        setView("done");
        setSearch("");
        setSelectedId(fresh.id);
        pushToast(`Implantação de “${fresh.name}” concluída.`);
      } else {
        pushToast(workflowUpdate.type === "task" && workflowUpdate.status === "done"
          ? "Etapa concluída. A próxima já foi liberada."
          : workflowUpdate.type === "task" && workflowUpdate.status === "in_progress"
            ? "Etapa iniciada. O quadro foi atualizado para toda a equipe."
            : "Fluxo de implantação atualizado.");
      }
    } catch (e) {
      replaceClient(originalClient);
      pushToast(errMsg(e, "Não foi possível atualizar a implantação."));
      void fetchState();
    } finally {
      setWorkflowSaving(false);
    }
  };

  const reopenClient = (client: ClientT) => {
    const meNow = meRef.current;
    if (!meNow) return;
    if (
      !window.confirm(
        `Reabrir a implantação de ${client.name}? A etapa de vinculação voltará para Em andamento.`,
      )
    ) {
      return;
    }
    api
      .patchClient(client.id, {
        op: "reopen",
        actor: { id: meNow.id, name: meNow.name },
      })
      .then(({ client: fresh }) => {
        replaceClient(fresh);
        setView("active");
        setSearch("");
        setSelectedId(fresh.id);
        pushToast("Implantação reaberta. A equipe foi avisada.");
      })
      .catch((e) => {
        pushToast(errMsg(e, "Não foi possível reabrir."));
        void fetchState();
      });
  };

  const deleteFinishedClient = async (client: ClientT) => {
    const meNow = meRef.current;
    if (!meNow) return;
    if (
      !window.confirm(
        `Deseja excluir permanentemente o cliente finalizado “${client.name}”? Essa ação não poderá ser desfeita.`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const { deletedId } = await api.deleteClient(client.id, {
        actor: { id: meNow.id, name: meNow.name },
      });

      setDeletedClientIds((prev) => (prev.includes(deletedId) ? prev : [...prev, deletedId]));

      setData((prev) => {
        const next = prev
          ? { ...prev, clients: prev.clients.filter((x) => x.id !== deletedId) }
          : prev;
        try {
          localStorage.setItem(CLIENT_BACKUP_KEY, JSON.stringify(next ?? prev));
        } catch {
          // sem armazenamento disponível
        }
        return next;
      });

      setSelectedId((cur) => (cur === deletedId ? null : cur));
      setView("done");
      setSearch("");
      pushToast("Cliente finalizado excluído.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível excluir o cliente finalizado."));
      void fetchState();
    } finally {
      setSaving(false);
    }
  };

  const exportBackup = () => {
    if (!clients) return;
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        economicGroup: c.economicGroup,
        attendanceUnit: c.attendanceUnit,
        attendanceUnits: c.attendanceUnits,
        phone: c.phone,
        notes: c.notes,
        checks: c.checks,
        workflow: clientWorkflow(c),
        finishedAt: c.finishedAt,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "checkflow-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    pushToast("Backup preparado para download.");
  };

  const importBackup = async (file: File) => {
    const meNow = meRef.current;
    if (!meNow) return;
    try {
      if (file.size > 10_000_000) throw new Error("size");
      const payload = JSON.parse(await file.text()) as {
        clients?: unknown;
      };
      if (!payload || !Array.isArray(payload.clients)) throw new Error("invalid");
      if (
        !window.confirm(
          `Restaurar este backup com ${payload.clients.length} clientes? Os registros atuais serão substituídos para toda a equipe.`,
        )
      ) {
        return;
      }
      const res = await api.importClients({
        payload,
        actor: { id: meNow.id, name: meNow.name },
      });
      await fetchState();
      setView("active");
      setSearch("");
      setSelectedId(null);
      pushToast(`Backup restaurado com ${res.count} clientes para todos.`);
    } catch (e) {
      pushToast(
        errMsg(
          e,
          "Não foi possível importar: use um backup JSON válido gerado por este site (até 10 MB).",
        ),
      );
    }
  };

  const resetPassword = async ({
    collaboratorId,
    password,
    confirmPassword,
  }: {
    collaboratorId: string;
    password: string;
    confirmPassword: string;
  }) => {
    const meNow = meRef.current;
    if (!meNow) return;

    if (!collaboratorId || !password || !confirmPassword) {
      throw new Error("Preencha a nova senha e confirme.");
    }

    if (password.length < 4) {
      throw new Error("A nova senha deve ter pelo menos 4 caracteres.");
    }

    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId, password, confirmPassword }),
    });

    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(json.error ?? "Não foi possível redefinir a senha.");
    }

    if (collaboratorId === meNow.id) {
      const nextMe = { ...meNow };
      try {
        localStorage.setItem(ME_KEY, JSON.stringify(nextMe));
      } catch {
        // sem armazenamento disponível
      }
    }

    await fetchState();
    pushToast("Senha redefinida com sucesso.");
  };

  const logout = useCallback(() => {
    setTopMenuOpen(false);
    localStorage.removeItem(ME_KEY);
    setMe(null);
    setNeedSetup(true);
    setProfileOpen(false);
    setAdminOpen(false);
    setTeamOpen(false);
    setActivityOpen(false);
    setActivityAlert(false);
    setSelectedCollaboratorId(null);
    setSelectedId(null);
    setSearch("");
    pushToast("Você saiu da conta.");
  }, [pushToast]);

  const deleteCollaborator = async (id: string) => {
    const meNow = meRef.current;
    if (!meNow) return;
    if (!window.confirm("Deseja excluir este colaborador?")) return;
    setData((prev) => ({
      ...prev,
      collaborators: prev.collaborators.filter((person) => person.id !== id),
    }));
    try {
      setSaving(true);
      await api.deleteCollaborator(id);
      pushToast("Colaborador removido.");
      if (id === meNow.id) {
        localStorage.removeItem(ME_KEY);
        setMe(null);
        setNeedSetup(true);
      }
      await fetchState();
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível excluir o colaborador."));
    } finally {
      setSaving(false);
    }
  };

  /* ---------- render ---------- */

  const emptyText = search.trim()
    ? "Nenhum cliente encontrado."
    : view === "done"
      ? "Seus clientes finalizados aparecerão aqui."
      : "Nenhum cliente em andamento.";

  const downloadDashboardPdf = async () => {
    if (!clients || !clients.length) {
      pushToast("Ainda não há clientes para exportar.");
      return;
    }

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 42;
    const contentWidth = pageWidth - margin * 2;
    const generatedAt = new Date();
    const generatedLabel = generatedAt.toLocaleString("pt-BR");
    let y = 0;

    doc.setProperties({
      title: "Relatório executivo OnioCheck",
      subject: "Resumo de clientes, lojas e etapas da operação",
      author: "OnioCheck",
    });

    const drawRunningHeader = () => {
      doc.setFillColor(14, 59, 110);
      doc.rect(0, 0, pageWidth, 62, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(19);
      doc.text("OnioCheck", margin, 29);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("RELATÓRIO EXECUTIVO · OPERAÇÃO", margin, 46);
      doc.setTextColor(217, 231, 250);
      doc.text(`Emitido em ${generatedLabel}`, pageWidth - margin, 42, { align: "right" });
    };

    const addContentPage = () => {
      doc.addPage();
      drawRunningHeader();
      y = 84;
    };

    const ensureRoom = (height: number) => {
      if (y + height > pageHeight - 58) addContentPage();
    };

    const sectionHeading = (title: string) => {
      ensureRoom(36);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(26, 44, 70);
      doc.text(title, margin, y + 12);
      doc.setDrawColor(220, 229, 242);
      doc.setLineWidth(0.8);
      doc.line(margin, y + 19, pageWidth - margin, y + 19);
      y += 30;
    };

    drawRunningHeader();
    y = 82;

    const metrics = [
      { label: "Ativos", value: String(dashboardSummary.activeClients) },
      { label: "Finalizados", value: String(dashboardSummary.finishedClients) },
      { label: "Taxa geral", value: `${dashboardSummary.completionRate}%` },
      { label: "Lojas", value: String(dashboardSummary.storeSummary.length) },
    ];

    const cardWidth = (contentWidth - 18) / 4;
    metrics.forEach((item, index) => {
      const x = margin + index * (cardWidth + 6);
      doc.setFillColor(239, 245, 255);
      doc.roundedRect(x, y, cardWidth, 58, 9, 9, "F");
      doc.setDrawColor(206, 220, 245);
      doc.setLineWidth(1);
      doc.roundedRect(x, y, cardWidth, 58, 9, 9, "S");
      doc.setTextColor(96, 112, 138);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(item.label.toUpperCase(), x + 12, y + 21);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(item.value, x + 12, y + 45);
    });

    y += 76;
    sectionHeading("Finalizações semanais");

    const weeklyCards = [
      { label: "Nesta semana", value: dashboardSummary.storesFinishedThisWeek },
      { label: "Última semana", value: dashboardSummary.storesFinishedLastWeek },
    ];
    const weeklyWidth = (contentWidth - 12) / 2;
    weeklyCards.forEach((item, index) => {
      const x = margin + index * (weeklyWidth + 12);
      doc.setFillColor(246, 249, 255);
      doc.roundedRect(x, y, weeklyWidth, 42, 8, 8, "F");
      doc.setDrawColor(226, 233, 244);
      doc.roundedRect(x, y, weeklyWidth, 42, 8, 8, "S");
      doc.setTextColor(96, 112, 138);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(item.label, x + 12, y + 16);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(String(item.value), x + 12, y + 34);
    });
    y += 54;

    sectionHeading("Resumo por loja");

    if (!dashboardSummary.storeSummary.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(108, 124, 149);
      doc.text("Nenhuma loja com dados disponíveis para o período.", margin, y + 12);
      y += 26;
    }

    dashboardSummary.storeSummary.forEach((store) => {
      const nameLines = doc.splitTextToSize(store.name, contentWidth - 112) as string[];
      const rowHeight = Math.max(58, 42 + nameLines.length * 11);
      ensureRoom(rowHeight + 8);

      doc.setDrawColor(214, 224, 240);
      doc.setFillColor(250, 252, 255);
      doc.roundedRect(margin, y, contentWidth, rowHeight, 8, 8, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(nameLines, margin + 14, y + 18);
      doc.text(`${store.progress}%`, pageWidth - margin - 16, y + 20, { align: "right" });

      const barX = margin + 16;
      const barWidth = contentWidth - 32;
      const barY = y + rowHeight - 28;
      doc.setFillColor(228, 233, 241);
      doc.roundedRect(barX, barY, barWidth, 6, 3, 3, "F");
      if (store.progress > 0) {
        doc.setFillColor(37, 107, 239);
        doc.roundedRect(barX, barY, Math.max(4, (barWidth * store.progress) / 100), 6, 3, 3, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(92, 110, 136);
      doc.text(`${store.done} finalizados  ·  ${store.active} em andamento`, margin + 16, y + rowHeight - 8);

      y += rowHeight + 9;
    });

    sectionHeading("Clientes em foco");

    if (!dashboardSummary.priorityClients.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(108, 124, 149);
      doc.text("Nenhum cliente em andamento no momento.", margin, y + 12);
      y += 26;
    }

    dashboardSummary.priorityClients.forEach((client) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const nameLines = doc.splitTextToSize(client.name, contentWidth - 100) as string[];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const unitLines = doc.splitTextToSize(client.unit, contentWidth - 30) as string[];
      const rowHeight = Math.max(48, 17 + nameLines.length * 12 + unitLines.length * 10);
      ensureRoom(rowHeight + 7);

      doc.setFillColor(246, 249, 255);
      doc.setDrawColor(226, 233, 244);
      doc.roundedRect(margin, y, contentWidth, rowHeight, 8, 8, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(nameLines, margin + 14, y + 16);
      doc.text(`${client.progress}%`, pageWidth - margin - 14, y + 16, { align: "right" });
      doc.setTextColor(108, 124, 149);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(unitLines, margin + 14, y + 17 + nameLines.length * 12);
      y += rowHeight + 7;
    });

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(220, 229, 242);
      doc.setLineWidth(0.7);
      doc.line(margin, pageHeight - 38, pageWidth - margin, pageHeight - 38);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(113, 128, 150);
      doc.text("OnioCheck  ·  Relatório interno", margin, pageHeight - 23);
      doc.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 23, { align: "right" });
    }

    doc.save(`oniocheck-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`);
    pushToast("Relatório PDF baixado com sucesso.");
  };

  const booting = (!me && !needSetup) || (!!me && !initialDataLoaded);

  const agendaTitle = storesOpen ? "Cadastros/Lojas" : dashboardOpen ? "Dashboard" : agendaOpen ? "Agenda" : view === "active" ? "Em andamento" : "Finalizados";

  const renderRightPanel = () => (
    <ClientDetail
      client={selected}
      busy={saving || workflowSaving}
      onWorkflowUpdate={updateClientWorkflow}
      onRename={() => selected && setClientDialog({ mode: "rename", client: selected })}
      onNotes={() => selected && setNotesFor(selected)}
      onReopen={() => selected && reopenClient(selected)}
      onDelete={() => selected && deleteFinishedClient(selected)}
    />
  );

  if (booting) {
    return (
      <div className="loading-screen" aria-live="polite" aria-busy="true">
        <div className="loading-card">
          <Image src="/logo_oniocheck_horizontal.png" alt="OnioCheck" width={1200} height={429} className="loading-logo" priority />
          <span className="loading-spinner" aria-hidden="true" />
          <p>Carregando suas lojas e preparando o OnioCheck…</p>
          <div className="loading-bar" role="progressbar" aria-label="Carregando">
            <i />
          </div>
          <small className="loading-caption">Sincronizando os dados da equipe</small>
        </div>
      </div>
    );
  }

  return (
    <div className={`app${darkMode ? " dark" : ""}${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <Sidebar
        view={view}
        counts={{ active: activeClients.length, done: doneClients.length }}
        agendaCount={agendaEvents.length}
        dashboardActive={dashboardOpen}
        storesActive={storesOpen}
        onView={changeView}
        onOpenDashboard={openDashboard}
        onOpenAgenda={openAgenda}
        onOpenStores={openStores}
        agendaActive={agendaOpen}
        collaborators={collaborators}
        activities={activities}
        now={now}
        collapsed={sidebarCollapsed}
        teamOpen={teamOpen}
        activityOpen={activityOpen}
        activityAlert={activityAlert}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        onToggleTeam={() => setTeamOpen((value) => !value)}
        onToggleActivity={handleToggleActivity}
      />

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">{storesOpen ? "CADASTROS · LOJAS" : "GESTÃO DE CHECKLISTS · COLABORATIVO"}</div>
            <h1>{agendaTitle}</h1>
            <p className="muted">
              {storesOpen
                ? "Gerencie os cadastros e credenciais das lojas compartilhados com toda a equipe."
                : dashboardOpen
                ? "Visão geral da operação: lojas, clientes em andamento e progresso da equipe."
                : agendaOpen
                  ? "Planeje reuniões e eventos, com tipos personalizáveis e visualização por toda a equipe."
                  : view === "active"
                    ? "Cada etapa marcada é um passo a menos."
                    : "Histórico de clientes com todas as etapas concluídas."}
            </p>
          </div>
          <div className="top-actions">
            {!storesOpen && <span
              className={`pill ${live ? "on" : "off"}`}
              title={
                live
                  ? "Conectado: alterações da equipe chegam em tempo real"
                  : "Sem conexão em tempo real; atualizando a cada poucos segundos"
              }
            >
              <span className="pdot" />
              {live ? "Ao vivo" : "Reconectando…"}
            </span>}
            {!dashboardOpen && !agendaOpen && !storesOpen && (
              <button className="primary" onClick={() => setClientDialog({ mode: "new" })}>
                <Plus size={15} /> Novo cliente
              </button>
            )}
            {dashboardOpen && !storesOpen && (
              <button className="primary" type="button" onClick={() => void downloadDashboardPdf()}>
                <Plus size={15} /> Gerar PDF
              </button>
            )}
            <div className="top-menu-wrap" ref={topMenuRef}>
              <button
                type="button"
                className={`top-menu-trigger${topMenuOpen ? " open" : ""}`}
                aria-label={topMenuOpen ? "Fechar menu" : "Abrir menu"}
                aria-haspopup="menu"
                aria-expanded={topMenuOpen}
                aria-controls="site-action-menu"
                title={topMenuOpen ? "Fechar menu" : "Menu"}
                onClick={() => setTopMenuOpen((open) => !open)}
              >
                {topMenuOpen ? <X size={21} /> : <MenuIcon size={22} />}
              </button>
              {topMenuOpen && (
                <div className="top-action-menu" id="site-action-menu" role="menu" aria-label="Menu do usuário">
                  <div className="top-action-menu-heading">Conta e preferências</div>
                  <button type="button" role="menuitem" onClick={() => { setTopMenuOpen(false); setProfileOpen(true); }}>
                    <UserRound size={17} /> <span>Configurar perfil</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setTopMenuOpen(false); setAdminOpen(true); }}>
                    <Settings size={17} /> <span>Administrador</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => setDarkMode((current) => !current)}>
                    {darkMode ? <SunMedium size={17} /> : <MoonStar size={17} />}
                    <span>{darkMode ? "Tema claro" : "Tema escuro"}</span>
                  </button>
                  <div className="top-action-menu-divider" />
                  <button type="button" role="menuitem" className="top-action-logout" onClick={logout}>
                    <LogOut size={17} /> <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {storesOpen && <StoresView actor={{ id: me?.id ?? "", name: me?.name ?? "" }} />}

        {dashboardOpen && !storesOpen && (
          <div className="dashboard-shell">
            <section className="stats dashboard-stats" aria-label="Resumo do dashboard">
              <div className="stat dashboard-card">
                <small>Clientes ativos</small>
                <strong>{dashboardSummary.activeClients}</strong>
              </div>
              <div className="stat dashboard-card">
                <small>Clientes finalizados</small>
                <strong>{dashboardSummary.finishedClients}</strong>
              </div>
              <div className="stat dashboard-card">
                <small>Taxa de conclusão</small>
                <strong>{dashboardSummary.completionRate}%</strong>
              </div>
              <div className="stat dashboard-card">
                <small>Lojas monitoradas</small>
                <strong>{dashboardSummary.storeSummary.length}</strong>
              </div>
            </section>

            <section className="dashboard-insights">
              <div className="panel dashboard-mini-panel">
                <div className="list-head compact-head">
                  <h2>Finalizações</h2>
                </div>
                <div className="dashboard-insight-grid">
                  <div className="insight-box">
                    <small>Esta semana</small>
                    <strong>{dashboardSummary.storesFinishedThisWeek}</strong>
                  </div>
                  <div className="insight-box">
                    <small>Última semana</small>
                    <strong>{dashboardSummary.storesFinishedLastWeek}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="dashboard-charts">
              {dashboardChartExpanded && (
                <button
                  type="button"
                  className="chart-expanded-backdrop"
                  aria-label="Fechar gráfico ampliado"
                  onClick={() => setDashboardChartExpanded(false)}
                />
              )}
              <div className={`panel dashboard-chart-panel line-chart-card${dashboardChartExpanded ? " expanded" : ""}`}>
                <div className="list-head compact-head line-chart-heading">
                  <div className="line-chart-title">
                    <h2>Fluxo de implantação</h2>
                    <p>Avanço dos marcos do OnioChat em cada grupo de lojas.</p>
                  </div>
                  <div className="chart-heading-actions">
                    {dashboardChartExpanded && (
                      <>
                        <span className="chart-scroll-hint">Navegue pelas etapas</span>
                        <button type="button" className="chart-scroll-btn" aria-label="Rolar etapas para a esquerda" title="Etapas anteriores" onClick={() => chartPlotRef.current?.scrollBy({ left: -520, behavior: "smooth" })}>
                          <ChevronLeft size={18} />
                        </button>
                        <button type="button" className="chart-scroll-btn" aria-label="Rolar etapas para a direita" title="Próximas etapas" onClick={() => chartPlotRef.current?.scrollBy({ left: 520, behavior: "smooth" })}>
                          <ChevronRight size={18} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="chart-expand-btn"
                      aria-label={dashboardChartExpanded ? "Recolher gráfico" : "Expandir gráfico"}
                      aria-expanded={dashboardChartExpanded}
                      title={dashboardChartExpanded ? "Recolher gráfico" : "Expandir gráfico"}
                      onClick={() => setDashboardChartExpanded((expanded) => !expanded)}
                    >
                      {dashboardChartExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                      <span>{dashboardChartExpanded ? "Recolher" : "Expandir"}</span>
                    </button>
                  </div>
                </div>
                <div className="line-chart-wrap">
                  <div className="line-chart-legend" aria-label="Legenda do gráfico">
                    {chartSeries.map((series) => (
                      <button
                        key={series.key}
                        type="button"
                        className={`chart-legend-toggle${hiddenChartSeries.includes(series.key) ? " muted" : ""}`}
                        aria-pressed={!hiddenChartSeries.includes(series.key)}
                        aria-label={`${hiddenChartSeries.includes(series.key) ? "Mostrar" : "Ocultar"} linha ${series.label}`}
                        onClick={() => setHiddenChartSeries((current) => current.includes(series.key)
                          ? current.filter((key) => key !== series.key)
                          : [...current, series.key])}
                      >
                        <i className={`legend-line${"dashed" in series && series.dashed ? " dashed" : ""}`} style={{ borderTopColor: series.color }} />
                        {series.label}
                      </button>
                    ))}
                  </div>
                  {visibleChartSeries.length ? <div ref={chartPlotRef} className={`line-chart-plot${chartDragRef.current ? " dragging" : ""}`} onPointerDown={(event) => {
                    if (!dashboardChartExpanded || event.pointerType === "touch" || event.button !== 0) return;
                    chartDragRef.current = {
                      pointerId: event.pointerId,
                      x: event.clientX,
                      y: event.clientY,
                      scrollLeft: event.currentTarget.scrollLeft,
                      scrollTop: event.currentTarget.scrollTop,
                    };
                    event.currentTarget.classList.add("dragging");
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }} onPointerMove={(event) => {
                    const drag = chartDragRef.current;
                    if (!drag || drag.pointerId !== event.pointerId) return;
                    event.currentTarget.scrollLeft = drag.scrollLeft - (event.clientX - drag.x);
                    event.currentTarget.scrollTop = drag.scrollTop - (event.clientY - drag.y);
                  }} onPointerUp={(event) => {
                    if (chartDragRef.current?.pointerId === event.pointerId) chartDragRef.current = null;
                    event.currentTarget.classList.remove("dragging");
                  }} onPointerCancel={(event) => {
                    if (chartDragRef.current?.pointerId === event.pointerId) chartDragRef.current = null;
                    event.currentTarget.classList.remove("dragging");
                  }} onWheel={(event) => {
                    if (dashboardChartExpanded && event.shiftKey) {
                      event.currentTarget.scrollLeft += event.deltaY;
                      event.preventDefault();
                    }
                  }}>
                    <svg className="steps-line-chart" viewBox={`0 0 ${chartViewWidth} ${chartViewHeight}`} role="img" aria-label="Avanço dos marcos de implantação, separado entre lojas em andamento e finalizadas">
                    {[0, 25, 50, 75, 100].map((value) => {
                      const y = chartY(value);
                      return <g key={value}>
                        <line x1="56" x2={chartViewWidth - 56} y1={y} y2={y} className="chart-grid-line" />
                        <text x="44" y={y + 4} className="chart-axis-label" textAnchor="end">{value}%</text>
                      </g>;
                    })}
                    {visibleChartSeries.map((series) => (
                      <g key={series.key}>
                        {lineChartSteps.length > 1 && <polyline
                          points={series.values.map((value, index) => `${chartX(index)},${chartY(value)}`).join(" ")}
                          className="chart-line"
                          style={{ stroke: series.color, strokeDasharray: "dashed" in series && series.dashed ? "7 6" : undefined }}
                        />}
                        {series.values.map((value, index) => {
                          const pointTitle = series.key === "active-average"
                            ? `${series.label}: ${value}%`
                            : `${series.label} · ${lineChartSteps[index].label}: ${series.counts[index]}/${series.total} (${value}%)`;
                          return (
                            <circle key={`${series.key}-${lineChartSteps[index].label}`} cx={chartX(index)} cy={chartY(value)} r="4.2" className="chart-point" style={{ fill: series.color }}>
                              <title>{pointTitle}</title>
                            </circle>
                          );
                        })}
                      </g>
                    ))}
                    {lineChartSteps.map((step, index) => {
                      const x = chartX(index);
                      const shortLabel = dashboardChartExpanded || step.label.length <= 14
                        ? step.label
                        : `${step.label.slice(0, 13)}…`;
                      return <g key={step.label}>
                        <text x={x} y={chartLabelY} className="chart-step-label" textAnchor="middle"><title>{step.label}</title>{shortLabel}</text>
                      </g>;
                    })}
                    </svg>
                  </div> : (
                    <p className="chart-empty">{chartSeries.length ? "Todas as linhas estão ocultas. Selecione uma legenda para mostrá-las." : "Cadastre ou reabra lojas para comparar o progresso por etapa."}</p>
                  )}
                </div>
              </div>

              <div className="panel dashboard-chart-panel">
                <div className="list-head compact-head">
                  <h2>Resumo da operação</h2>
                </div>
                <div className="operation-metrics" aria-label="Resumo da operação">
                  {[
                    { label: "Em andamento", value: dashboardSummary.activeClients, tone: "active" },
                    { label: "Finalizados", value: dashboardSummary.finishedClients, tone: "finished" },
                    { label: "Conclusão", value: `${dashboardSummary.completionRate}%`, tone: "rate" },
                  ].map((item) => (
                    <div key={item.label} className={`operation-metric ${item.tone}`}>
                      <span className="metric-mark" />
                      <small>{item.label}</small>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="dashboard-grid">
              <section className="panel dashboard-panel">
                <div className="list-head">
                  <h2>Resumo por loja</h2>
                </div>
                <div className="dashboard-list">
                  {dashboardSummary.storeSummary.length ? (
                    dashboardSummary.storeSummary.map((store) => (
                      <div key={store.name} className="dashboard-row">
                        <div className="dashboard-row-top">
                          <span>{store.name}</span>
                          <strong>{store.progress}%</strong>
                        </div>
                        <div className="progress-track">
                          <span style={{ width: `${store.progress}%` }} />
                        </div>
                        <small>
                          {store.done} concluídos · {store.active} em andamento
                        </small>
                      </div>
                    ))
                  ) : (
                    <p className="empty">Nenhuma loja cadastrada.</p>
                  )}
                </div>
              </section>

              <section className="panel dashboard-panel">
                <div className="list-head">
                  <h2>Clientes em foco</h2>
                </div>
                <div className="dashboard-list">
                  {dashboardSummary.priorityClients.length ? (
                    dashboardSummary.priorityClients.map((client) => (
                      <div key={client.id} className="dashboard-focus-item">
                        <div className="dashboard-focus-head">
                          <strong>{client.name}</strong>
                          <span>{client.progress}%</span>
                        </div>
                        <small>{client.unit}</small>
                        <div className="progress-track small-track">
                          <span style={{ width: `${client.progress}%` }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="empty">Todos os clientes estão concluídos.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {!dashboardOpen && !storesOpen && (
          <>
            <section className="stats" aria-label="Resumo">
              <div className="stat">
                <small>Clientes em andamento</small>
                <strong>{activeClients.length}</strong>
              </div>
              <div className="stat">
                <small>Clientes finalizados</small>
                <strong>{doneClients.length}</strong>
              </div>
              <div className="stat">
                <small>Etapas concluídas · ativos</small>
                <strong>
                  {stepsDone} / {totalSteps}
                </strong>
              </div>
              <div className="stat">
                <small>Equipe online agora</small>
                <strong>{onlineCollabs.length}</strong>
                <div className="stack">
                  {onlineCollabs.slice(0, 6).map((c) => (
                    <Avatar
                      key={c.id}
                      name={c.name}
                      color={c.color}
                      size={24}
                      lightBorder
                      imageUrl={c.avatarUrl ?? null}
                    />
                  ))}
                  {onlineCollabs.length > 6 && (
                    <span className="stack-more">+{onlineCollabs.length - 6}</span>
                  )}
                </div>
              </div>
            </section>

            {view === "active" && !agendaOpen && <section className="step-filters panel" aria-label="Filtros de etapas">
              <div className="list-head step-filter-head">
                <div className="step-filter-title">
                  <span className="step-filter-heading-icon"><ListFilter size={18} /></span>
                  <div>
                    <h2>Filtrar por etapa</h2>
                    <p>Encontre as lojas pelo próximo marco pendente da implantação.</p>
                  </div>
                </div>
                <div className="step-filter-actions">
                  <button
                    type="button"
                    className={`secondary small advanced-filter-toggle${selectedStepFilters.length > 1 ? " has-selection" : ""}`}
                    aria-expanded={advancedFiltersOpen}
                    aria-controls="advanced-step-filters"
                    onClick={() => setAdvancedFiltersOpen((open) => !open)}
                  >
                    <SlidersHorizontal size={15} /> Filtro avançado
                    {selectedStepFilters.length > 0 && <em>{selectedStepFilters.length}</em>}
                  </button>
                  {selectedStepFilters.length > 0 && (
                    <button type="button" className="link-btn" onClick={() => setSelectedStepFilters([])}>
                      <RotateCcw size={14} /> Limpar
                    </button>
                  )}
                </div>
              </div>
              <div className="step-filter-list">
                <button
                  type="button"
                  className={`step-filter-pill ${selectedStepFilters.length === 0 ? "active" : ""}`}
                  aria-pressed={selectedStepFilters.length === 0}
                  onClick={() => setSelectedStepFilters([])}
                >
                  <span>Todos</span>
                  <em>{activeClients.length}</em>
                </button>
                {WORKFLOW_FILTERS.map((step) => {
                  const count = activeClients.filter((client) => isWorkflowFilterPending(clientWorkflow(client), step.id)).length;
                  const active = selectedStepFilters.length === 1 && selectedStepFilters[0] === step.id;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      className={`step-filter-pill ${active ? "active" : ""}`}
                      aria-pressed={active}
                      onClick={() => setSelectedStepFilters((value) => value.length === 1 && value[0] === step.id ? [] : [step.id])}
                      title={`${count} implantações ainda estão pendentes em ${step.label.toLowerCase()}`}
                    >
                      <span>{step.label}</span>
                      <em>{count}</em>
                    </button>
                  );
                })}
              </div>
              {advancedFiltersOpen && (
                <div className="advanced-step-filters" id="advanced-step-filters">
                  <div className="advanced-step-copy">
                    <strong>Escolha uma ou mais etapas</strong>
                    <span>Exibe implantações com pelo menos um marco selecionado pendente.</span>
                  </div>
                  <div className="advanced-step-options">
                    {WORKFLOW_FILTERS.map((step) => (
                      <label key={step.id} className="advanced-step-option">
                        <input
                          type="checkbox"
                          checked={selectedStepFilters.includes(step.id)}
                          onChange={() => setSelectedStepFilters((current) =>
                            current.includes(step.id)
                              ? current.filter((selected) => selected !== step.id)
                              : [...current, step.id],
                          )}
                        />
                        <span>{step.label}</span>
                        <em>{activeClients.filter((client) => isWorkflowFilterPending(clientWorkflow(client), step.id)).length}</em>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>}
          </>
        )}

        {!storesOpen && agendaOpen ? (
          <section className="agenda-layout">
            <div className="panel agenda-panel">
              <div className="list-head">
                <h2>Tipos de evento</h2>
              </div>
              <div className="agenda-controls">
                <button
                  className="primary"
                  onClick={() => setAgendaTypeDialog({ mode: "create", name: "", color: "#2d6fe8" })}
                  disabled={saving}
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
              <div className="agenda-tag-list">
                {agendaTypes.length ? (
                  agendaTypes.map((type) => (
                    <div key={type.id} className="agenda-tag-wrap">
                      <button
                        className="agenda-tag"
                        type="button"
                        onClick={() => setAgendaTypeDialog({ mode: "edit", type })}
                        style={{ background: `${type.color}15`, color: type.color, borderColor: `${type.color}50` }}
                      >
                        {type.name}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="muted small-copy">Cadastre o primeiro tipo para começar.</p>
                )}
              </div>
            </div>

            <div className="panel agenda-panel">
              <div className="list-head">
                <h2>Novo evento</h2>
              </div>
              <div className="agenda-form">
                <label>
                  <span>Título</span>
                  <input
                    type="text"
                    value={agendaForm.title}
                    onChange={(e) => setAgendaForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Ex.: Revisão de integração"
                  />
                </label>
                <label>
                  <span>Tipo</span>
                  <select
                    value={agendaForm.typeId}
                    onChange={(e) => setAgendaForm((prev) => ({ ...prev, typeId: e.target.value }))}
                  >
                    {agendaTypes.length ? (
                      agendaTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))
                    ) : (
                      <option value="">Cadastre um tipo primeiro</option>
                    )}
                  </select>
                </label>
                <div className="agenda-grid">
                  <label>
                    <span>Dia</span>
                    <input
                      type="date"
                      value={agendaForm.date}
                      onChange={(e) => setAgendaForm((prev) => ({ ...prev, date: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Início</span>
                    <input
                      type="time"
                      value={agendaForm.startTime}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setAgendaForm((prev) => ({
                          ...prev,
                          startTime: nextStart,
                          endTime: prev.endTime <= nextStart ? addOneHour(nextStart) : prev.endTime,
                        }));
                      }}
                    />
                  </label>
                  <label>
                    <span>Fim</span>
                    <input
                      type="time"
                      value={agendaForm.endTime}
                      onChange={(e) => {
                        const nextEnd = e.target.value;
                        setAgendaForm((prev) => ({
                          ...prev,
                          endTime: nextEnd <= prev.startTime ? addOneHour(prev.startTime) : nextEnd,
                        }));
                      }}
                    />
                  </label>
                </div>
                <label>
                  <span>Observações</span>
                  <textarea
                    value={agendaForm.notes}
                    onChange={(e) => setAgendaForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                    placeholder="Agenda, pauta, detalhes específicos..."
                  />
                </label>
                <div className="actions agenda-actions">
                  <button className="primary" onClick={createAgendaEvent} disabled={saving || !agendaTypes.length}>
                    <NotebookPen size={14} /> Salvar evento
                  </button>
                </div>
              </div>
            </div>

            <div className="panel agenda-panel event-list-panel">
              <div className="list-head">
                <h2>Próximos eventos</h2>
              </div>
              <div className="agenda-events">
                {upcomingEvents.length ? (
                  upcomingEvents.map((event) => {
                    const type = agendaTypeMap.get(event.typeId) ?? {
                      id: event.typeId,
                      name: event.typeName,
                      color: event.typeColor,
                    };
                    return (
                      <div key={event.id} className={`agenda-event-card ${event.finishedAt ? "done" : ""}`}>
                        <div className="agenda-event-header">
                          <span className="agenda-event-type" style={{ background: `${type.color}18`, color: type.color }}>
                            {type.name}
                          </span>
                          <div className="agenda-event-actions">
                            {event.finishedAt && (
                              <span className="agenda-finished-pill">Finalizado</span>
                            )}
                            <button type="button" className={`icon-btn ${event.finishedAt ? "done" : ""}`} onClick={() => void toggleAgendaEventStatus(event)} title={event.finishedAt ? "Reabrir evento" : "Marcar como finalizado"}>
                              <CheckCheck size={14} />
                            </button>
                            <button type="button" className="icon-btn" onClick={() => setAgendaEventDialog({ mode: "edit", event })} title="Editar evento">
                              <PencilLine size={14} />
                            </button>
                            <button type="button" className="icon-btn danger-icon" onClick={() => void deleteAgendaEvent(event)} title="Excluir evento">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <strong>{event.title}</strong>
                        <div className="agenda-event-meta">
                          <span>{new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</span>
                          <span>{event.startTime} - {event.endTime}</span>
                        </div>
                        {event.notes && <p>{event.notes}</p>}
                        <small>{event.finishedAt ? "Finalizado" : "Em andamento"} · Organizador: {event.organizerName}</small>
                      </div>
                    );
                  })
                ) : (
                  <p className="empty">Nenhum evento programado ainda.</p>
                )}
              </div>
            </div>
          </section>
        ) : (
          !dashboardOpen && !storesOpen && (
            <div className={`workspace${clientListCollapsed ? " clients-collapsed" : ""}`}>
              {clientListCollapsed ? (
                <button type="button" className="client-list-rail" onClick={() => setClientListCollapsed(false)} aria-label="Expandir lista de clientes" title="Mostrar lista de clientes">
                  <ChevronRight size={17} /><span>Clientes</span><small>{visible.length}</small>
                </button>
              ) : <ClientList
                title={
                  selectedStepFilters.length === 0
                    ? "Seus clientes"
                    : selectedStepFilters.length === 1
                      ? `Em ${WORKFLOW_FILTERS.find((step) => step.id === selectedStepFilters[0])?.label ?? "implantação"}`
                      : "Etapas selecionadas"
                }
                search={search}
                onSearch={setSearch}
                clients={visible}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onCollapse={() => setClientListCollapsed(true)}
                emptyText={
                  selectedStepFilters.length === 0
                    ? emptyText
                    : selectedStepFilters.length === 1
                      ? `Nenhuma loja tem pendências em ${WORKFLOW_FILTERS.find((step) => step.id === selectedStepFilters[0])?.label.toLowerCase() ?? "nesta etapa"}.`
                      : "Nenhuma loja tem marcos selecionados pendentes."
                }
              />}
              {renderRightPanel()}
            </div>
          )
        )}
      </main>

      {needSetup && (
        <AuthDialog
          busy={saving}
          onLogin={login}
          onRegister={register}
        />
      )}

      {adminOpen && (
        <AdminDialog
          collaborators={collaborators.map((c) => ({ id: c.id, name: c.name }))}
          busy={saving}
          onDelete={deleteCollaborator}
          onResetPassword={resetPassword}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {profileOpen && (
        <ProfileDialog
          currentUsername={me?.username ?? ""}
          currentDisplayName={me?.displayName ?? me?.name ?? ""}
          currentAvatarUrl={meAvatarUrl ?? ""}
          busy={saving}
          onCancel={() => setProfileOpen(false)}
          onSubmit={updateProfile}
        />
      )}

      {clientDialog && (
        <ClientDialog
          mode={clientDialog.mode}
          initialName={clientDialog.mode === "rename" ? clientDialog.client.name : ""}
          initialEconomicGroup={
            clientDialog.mode === "rename" ? clientDialog.client.economicGroup ?? "" : ""
          }
          initialAttendanceUnit={
            clientDialog.mode === "rename" ? clientDialog.client.attendanceUnit ?? "" : ""
          }
          initialAttendanceUnits={
            clientDialog.mode === "rename"
              ? clientDialog.client.attendanceUnits ?? (clientDialog.client.attendanceUnit ? [clientDialog.client.attendanceUnit] : [])
              : []
          }
          initialPhone={clientDialog.mode === "rename" ? clientDialog.client.phone ?? "" : ""}
          busy={saving}
          onCancel={() => setClientDialog(null)}
          onSubmit={clientDialog.mode === "new" ? createClient : renameClient}
        />
      )}

      {notesFor && (
        <ClientNotesDialog
          clientName={notesFor.name}
          initialNotes={notesFor.notes ?? ""}
          busy={saving}
          onCancel={() => setNotesFor(null)}
          onSubmit={saveClientNotes}
        />
      )}

      {teamOpen && (
        <TeamModal
          collaborators={collaborators}
          now={now}
          meId={me?.id ?? null}
          onClose={() => setTeamOpen(false)}
          onSelect={(id) => {
            setSelectedCollaboratorId(id);
            setTeamOpen(false);
          }}
        />
      )}

      {activityOpen && (
        <ActivityModal
          activities={activities}
          now={now}
          onClose={() => setActivityOpen(false)}
        />
      )}

      {selectedCollaborator && (
        <CollaboratorDetailDialog
          collaborator={selectedCollaborator}
          now={now}
          onClose={() => {
            setSelectedCollaboratorId(null);
            setTeamOpen(true);
          }}
        />
      )}

      {agendaTypeDialog && (
        <AgendaTypeDialog
          mode={agendaTypeDialog.mode}
          initialName={agendaTypeDialog.mode === "edit" ? agendaTypeDialog.type.name : agendaTypeDialog.name}
          initialColor={agendaTypeDialog.mode === "edit" ? agendaTypeDialog.type.color : agendaTypeDialog.color}
          busy={saving}
          onCancel={() => setAgendaTypeDialog(null)}
          onDelete={agendaTypeDialog.mode === "edit" ? () => { setAgendaTypeDialog(null); void deleteAgendaType(agendaTypeDialog.type); } : undefined}
          onConfirm={(name, color) => {
            if (agendaTypeDialog.mode === "create") {
              void createAgendaType({ name, color });
              return;
            }
            void updateAgendaType(agendaTypeDialog.type.id, name, color);
          }}
        />
      )}

      {agendaEventDialog && (
        <AgendaEventDialog
          typeOptions={agendaTypes}
          initialTitle={agendaEventDialog.event.title}
          initialTypeId={agendaEventDialog.event.typeId}
          initialDate={agendaEventDialog.event.date}
          initialStartTime={agendaEventDialog.event.startTime}
          initialEndTime={agendaEventDialog.event.endTime}
          initialNotes={agendaEventDialog.event.notes ?? ""}
          initialFinished={!!agendaEventDialog.event.finishedAt}
          busy={saving}
          onCancel={() => setAgendaEventDialog(null)}
          onDelete={() => void deleteAgendaEvent(agendaEventDialog.event)}
          onSubmit={(payload: { title: string; typeId: string; date: string; startTime: string; endTime: string; notes?: string | null; finished?: boolean; }) => void updateAgendaEvent(agendaEventDialog.event.id, payload)}
        />
      )}

      {!agendaOpen && !selectedCollaborator && (
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importBackup(file);
            e.target.value = "";
          }}
        />
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}
