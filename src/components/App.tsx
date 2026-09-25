"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCheck,
  Clock3,
  MoonStar,
  NotebookPen,
  PencilLine,
  Plus,
  Settings,
  SunMedium,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { summarizeDashboard } from "@/lib/dashboard";
import { STEPS } from "@/lib/steps";
import {
  activityParts,
  isOnline,
  norm,
  relTime,
  stepTotal,
} from "@/lib/format";
import type { Activity, AgendaEvent, AgendaType, AppState, ClientT, Collab } from "@/lib/types";
import Sidebar from "./Sidebar";
import ClientList from "./ClientList";
import ClientDetail from "./ClientDetail";
import {
  ActivityModal,
  AdminDialog,
  AgendaEventDialog,
  AgendaTypeDialog,
  ClientDialog,
  ClientNotesDialog,
  CollaboratorDetailDialog,
  FinishDialog,
  ProfileDialog,
  SetupDialog,
  TeamModal,
} from "./Dialogs";
import Toasts, { type ToastItem } from "./Toasts";
import Avatar from "./Avatar";

const ME_KEY = "oniocheck-me-v1";
const CLIENT_BACKUP_KEY = "oniocheck-client-backup-v1";
const DELETED_CLIENTS_KEY = "oniocheck-deleted-clients-v1";

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
  const [live, setLive] = useState(false);
  const [view, setView] = useState<"active" | "done">("active");
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [clientDialog, setClientDialog] = useState<
    { mode: "new" } | { mode: "rename"; client: ClientT } | null
  >(null);
  const [notesFor, setNotesFor] = useState<ClientT | null>(null);
  const [finishFor, setFinishFor] = useState<ClientT | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
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
  const [selectedStepFilter, setSelectedStepFilter] = useState<number | null>(null);
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
  const [now, setNow] = useState(() => Date.now());

  const fileRef = useRef<HTMLInputElement>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meRef = useRef<Me | null>(null);
  const lastSeenActivityRef = useRef<string | null>(null);

  useEffect(() => {
    meRef.current = me;
  }, [me]);

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
      if (newestActivityId && newestActivityId !== lastSeenActivityRef.current && !activityOpen) {
        setActivityAlert(true);
      }
      if (newestActivityId) {
        lastSeenActivityRef.current = newestActivityId;
      }
      try {
        localStorage.setItem(CLIENT_BACKUP_KEY, JSON.stringify(s));
      } catch {
        // sem armazenamento disponível
      }
    } catch {
      // mantém dados anteriores; o indicador de conexão avisa
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
        lastSeenActivityRef.current = data.activities[0]?.id ?? null;
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
          if (!activityOpen) setActivityAlert(true);
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
  }, [me, fetchState, scheduleRefetch, pushToast, activityOpen]);

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
    if (selectedStepFilter === null) return activeClients;
    return activeClients.filter((client) => !client.checks[selectedStepFilter]?.done);
  }, [activeClients, selectedStepFilter]);

  const visible = useMemo(() => {
    const q = norm(search.trim());
    const baseList = view === "active"
      ? (selectedStepFilter === null ? activeClients : filteredStepClients)
      : doneClients;
    return q ? baseList.filter((c) => norm(c.name).includes(q)) : baseList;
  }, [view, search, activeClients, doneClients, filteredStepClients, selectedStepFilter]);

  const selected =
    filteredClients.find((c) => c.id === selectedId) ??
    visible[0] ??
    null;
  const onlineCollabs = collaborators.filter((c) => isOnline(c, now));
  const stepsDone = activeClients.reduce((n, c) => n + stepTotal(c), 0);
  const selectedCollaborator =
    collaborators.find((c) => c.id === selectedCollaboratorId) ?? null;
  const dashboardSummary = useMemo(() => summarizeDashboard(filteredClients), [filteredClients]);
  const stepBreakdown = useMemo(
    () =>
      STEPS.map((step, index) => {
        const done = activeClients.filter((client) => client.checks[index]?.done).length;
        const missing = activeClients.length - done;
        return {
          label: step,
          index,
          done,
          missing,
          progress: activeClients.length ? Math.round((done / activeClients.length) * 100) : 0,
        };
      }),
    [activeClients],
  );
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
    setView(v);
    setDashboardOpen(false);
    setAgendaOpen(false);
    setSearch("");
    setSelectedId(null);
    setSelectedCollaboratorId(null);
    setSelectedStepFilter(null);
  };

  const openDashboard = () => {
    setDashboardOpen(true);
    setAgendaOpen(false);
    setSelectedCollaboratorId(null);
    setSelectedId(null);
    setSearch("");
  };

  const openAgenda = () => {
    setDashboardOpen(false);
    setAgendaOpen(true);
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

  const login = async (username: string, password?: string) => {
    setSaving(true);
    try {
      const current = meRef.current;
      if (!password && current) {
        const { collaborator } = await api.join({ id: current.id, name: username });
        const next: Me = {
          id: collaborator.id,
          name: collaborator.name,
          color: collaborator.color,
          username,
          role: current.role,
        };
        try {
          localStorage.setItem(ME_KEY, JSON.stringify(next));
        } catch {
          // armazenamento indisponível — sessão ainda funciona
        }
        setMe(next);
        setNeedSetup(false);
        pushToast("Nome e usuário atualizados para a equipe.");
        void fetchState();
        return;
      }

      const payload = {
        username,
        password: password ?? "",
      };
      const { user, collaborator } = await api.login(payload);
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
      pushToast(
        current
          ? `Usuário atualizado para ${user.username}.`
          : `Bem-vindo(a), ${user.username}!`,
      );
      void fetchState();
    } catch (e) {
      const msg = errMsg(e, "Não foi possível entrar. Verifique usuário e senha.");
      pushToast(
        msg === "Senha incorreta." ? "Senha incorreta. Verifique a senha do usuário." : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStep = (client: ClientT, index: number, value: boolean) => {
    const meNow = meRef.current;
    if (!meNow || client.finishedAt) return;
    const checks = client.checks.map((s, i) =>
      i === index
        ? {
            done: value,
            by: value ? meNow.name : null,
            at: value ? new Date().toISOString() : null,
          }
        : s,
    );
    const optimistic: ClientT = {
      ...client,
      checks,
      updatedAt: new Date().toISOString(),
    };
    replaceClient(optimistic);
    api
      .patchClient(client.id, {
        op: "step",
        index,
        value,
        actor: { id: meNow.id, name: meNow.name },
      })
      .then(({ client: fresh }) => replaceClient(fresh))
      .catch((e) => {
        pushToast(errMsg(e, "Não foi possível salvar a alteração."));
        void fetchState();
      });
    if (value && checks.every((s) => s.done)) setFinishFor(optimistic);
  };

  const createClient = async ({
    name,
    economicGroup,
    attendanceUnit,
    phone,
  }: {
    name: string;
    economicGroup?: string | null;
    attendanceUnit?: string | null;
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
    phone,
    notes,
  }: {
    name: string;
    economicGroup?: string | null;
    attendanceUnit?: string | null;
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

  const finishClient = async () => {
    const meNow = meRef.current;
    const target = finishFor;
    if (!meNow || !target) return;
    setSaving(true);
    try {
      const { client } = await api.patchClient(target.id, {
        op: "finish",
        actor: { id: meNow.id, name: meNow.name },
      });
      replaceClient(client);
      setFinishFor(null);
      setView("done");
      setSearch("");
      setSelectedId(client.id);
      pushToast(`“${client.name}” finalizado. Disponível em Finalizados.`);
    } catch (e) {
      setFinishFor(null);
      pushToast(errMsg(e, "Não foi possível finalizar."));
    } finally {
      setSaving(false);
    }
  };

  const reopenClient = (client: ClientT) => {
    const meNow = meRef.current;
    if (!meNow) return;
    if (
      !window.confirm(
        `Reabrir o checklist de ${client.name}? Ele voltará para Em andamento, mantendo as marcações.`,
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
        pushToast("Checklist reaberto. A equipe foi avisada.");
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
        checks: c.checks,
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
    let y = 52;

    doc.setFillColor(14, 59, 110);
    doc.rect(0, 0, pageWidth, 74, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("OnioCheck", margin, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Relatório executivo de operação", margin, 48);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, pageWidth - margin, 48, { align: "right" });

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
      doc.roundedRect(x, 92, cardWidth, 52, 9, 9, "F");
      doc.setDrawColor(206, 220, 245);
      doc.setLineWidth(1);
      doc.roundedRect(x, 92, cardWidth, 52, 9, 9, "S");
      doc.setTextColor(96, 112, 138);
      doc.setFontSize(9);
      doc.text(item.label, x + 16, 116);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(item.value, x + 16, 132);
    });

    y = 170;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Evolução semanal", margin, y);
    y += 16;

    const weeklyCards = [
      { label: "Nesta semana", value: dashboardSummary.storesFinishedThisWeek },
      { label: "Última semana", value: dashboardSummary.storesFinishedLastWeek },
    ];
    const weeklyWidth = (contentWidth - 12) / 2;
    weeklyCards.forEach((item, index) => {
      const x = margin + index * (weeklyWidth + 12);
      doc.setFillColor(246, 249, 255);
      doc.roundedRect(x, y, weeklyWidth, 34, 8, 8, "F");
      doc.setTextColor(96, 112, 138);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(item.label, x + 12, y + 15);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(String(item.value), x + 12, y + 28);
    });
    y += 48;

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Resumo por loja", margin, y);
    y += 16;

    dashboardSummary.storeSummary.forEach((store) => {
      if (y > pageHeight - 115) {
        doc.addPage();
        y = 54;
      }

      doc.setDrawColor(214, 224, 240);
      doc.setFillColor(250, 252, 255);
      doc.roundedRect(margin, y, contentWidth, 52, 8, 8, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(store.name, margin + 16, y + 20);
      doc.text(`${store.progress}%`, pageWidth - margin - 16, y + 20, { align: "right" });

      const barX = margin + 16;
      const barWidth = contentWidth - 32;
      doc.setFillColor(228, 233, 241);
      doc.roundedRect(barX, y + 26, barWidth, 8, 4, 4, "F");
      doc.setFillColor(37, 107, 239);
      doc.roundedRect(barX, y + 26, (barWidth * store.progress) / 100, 8, 4, 4, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(92, 110, 136);
      doc.text(`${store.done} concluídos · ${store.active} em andamento`, margin + 16, y + 44);

      y += 64;
    });

    if (y > pageHeight - 110) {
      doc.addPage();
      y = 54;
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Clientes em foco", margin, y);
    y += 16;

    dashboardSummary.priorityClients.forEach((client) => {
      if (y > pageHeight - 76) {
        doc.addPage();
        y = 54;
      }

      doc.setFillColor(246, 249, 255);
      doc.roundedRect(margin, y, contentWidth, 28, 8, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(client.name, margin + 14, y + 16);
      doc.text(`${client.progress}%`, pageWidth - margin - 14, y + 16, { align: "right" });
      doc.setTextColor(108, 124, 149);
      doc.setFont("helvetica", "normal");
      doc.text(client.unit, margin + 14, y + 25);
      y += 36;
    });

    doc.save(`oniocheck-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`);
    pushToast("Relatório PDF baixado com sucesso.");
  };

  const booting = !me && !needSetup;

  const agendaTitle = dashboardOpen ? "Dashboard" : agendaOpen ? "Agenda" : view === "active" ? "Em andamento" : "Finalizados";

  const renderRightPanel = () => (
    <ClientDetail
      client={selected}
      onToggle={(i, v) => selected && toggleStep(selected, i, v)}
      onRename={() => selected && setClientDialog({ mode: "rename", client: selected })}
      onNotes={() => selected && setNotesFor(selected)}
      onFinish={() => selected && setFinishFor(selected)}
      onReopen={() => selected && reopenClient(selected)}
      onDelete={() => selected && deleteFinishedClient(selected)}
    />
  );

  if (booting) {
    return (
      <div className="loading-screen">
        <img src="/logo_oniocheck_transparente.svg" alt="OnioCheck" className="loading-logo" />
        <p>Conectando ao servidor...</p>
        <div className="loading-bar" aria-label="Carregando">
          <i />
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
        onView={changeView}
        onOpenDashboard={openDashboard}
        onOpenAgenda={openAgenda}
        agendaActive={agendaOpen}
        collaborators={collaborators}
        activities={activities}
        meId={me?.id ?? null}
        meAvatarUrl={meAvatarUrl}
        meName={me?.name ?? null}
        now={now}
        collapsed={sidebarCollapsed}
        teamOpen={teamOpen}
        activityOpen={activityOpen}
        activityAlert={activityAlert}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        onToggleTeam={() => setTeamOpen((value) => !value)}
        onToggleActivity={handleToggleActivity}
        onEditIdentity={() => setNeedSetup(true)}
        onOpenAdmin={() => setAdminOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onLogout={logout}
        onSelectCollaborator={setSelectedCollaboratorId}
      />

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">GESTÃO DE CHECKLISTS · COLABORATIVO</div>
            <h1>{agendaTitle}</h1>
            <p className="muted">
              {dashboardOpen
                ? "Visão geral da operação: lojas, clientes em andamento e progresso da equipe."
                : agendaOpen
                  ? "Planeje reuniões e eventos, com tipos personalizáveis e visualização por toda a equipe."
                  : view === "active"
                    ? "Cada etapa marcada é um passo a menos."
                    : "Histórico de clientes com todas as etapas concluídas."}
            </p>
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="secondary small icon-only"
              onClick={() => setDarkMode((v) => !v)}
              aria-label={darkMode ? "Ativar modo claro" : "Ativar modo escuro"}
              title={darkMode ? "Modo claro" : "Modo escuro"}
            >
              {darkMode ? <SunMedium size={20} /> : <MoonStar size={20} />}
            </button>
            <span
              className={`pill ${live ? "on" : "off"}`}
              title={
                live
                  ? "Conectado: alterações da equipe chegam em tempo real"
                  : "Sem conexão em tempo real; atualizando a cada poucos segundos"
              }
            >
              <span className="pdot" />
              {live ? "Ao vivo" : "Reconectando…"}
            </span>
            {!dashboardOpen && !agendaOpen && (
              <button className="primary" onClick={() => setClientDialog({ mode: "new" })}>
                <Plus size={15} /> Novo cliente
              </button>
            )}
            {dashboardOpen && (
              <button className="primary" type="button" onClick={() => void downloadDashboardPdf()}>
                <Plus size={15} /> Gerar PDF
              </button>
            )}
          </div>
        </header>

        {dashboardOpen && (
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
              <div className="panel dashboard-chart-panel">
                <div className="list-head compact-head">
                  <h2>Etapas concluídas</h2>
                </div>
                <div className="chart-bars">
                  {stepBreakdown.slice(0, 6).map((step) => (
                    <div key={step.label} className="chart-row">
                      <div className="chart-row-head">
                        <span>{step.label}</span>
                        <strong>{step.progress}%</strong>
                      </div>
                      <div className="progress-track chart-track">
                        <span style={{ width: `${step.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel dashboard-chart-panel">
                <div className="list-head compact-head">
                  <h2>Resumo da operação</h2>
                </div>
                <div className="bar-columns" aria-label="Resumo da operação">
                  {[{ label: "Ativas", value: dashboardSummary.activeClients }, { label: "Finalizadas", value: dashboardSummary.finishedClients }, { label: "Taxa", value: dashboardSummary.completionRate }].map((item) => (
                    <div key={item.label} className="bar-column-wrap">
                      <div className="bar-column-label">{item.label}</div>
                      <div className="bar-column">
                        <span style={{ height: `${Math.max(item.value === dashboardSummary.completionRate ? item.value : Math.min(item.value * 22, 100), 8)}%` }} />
                      </div>
                      <strong>{item.label === "Taxa" ? `${item.value}%` : item.value}</strong>
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

        {!dashboardOpen && (
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
                  {stepsDone} / {activeClients.length * 10}
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

            <section className="step-filters panel" aria-label="Filtros de etapas">
              <div className="list-head step-filter-head">
                <h2>Filtrar por etapa</h2>
                {selectedStepFilter !== null && (
                  <button type="button" className="link-btn" onClick={() => setSelectedStepFilter(null)}>
                    Limpar filtro
                  </button>
                )}
              </div>
              <div className="step-filter-list">
                <button
                  type="button"
                  className={`step-filter-pill ${selectedStepFilter === null ? "active" : ""}`}
                  onClick={() => setSelectedStepFilter(null)}
                >
                  <span>Todos</span>
                  <em>{activeClients.length}</em>
                </button>
                {STEPS.map((step, index) => {
                  const count = activeClients.filter((client) => !client.checks[index]?.done).length;
                  const active = selectedStepFilter === index;
                  return (
                    <button
                      key={step}
                      type="button"
                      className={`step-filter-pill ${active ? "active" : ""}`}
                      onClick={() => setSelectedStepFilter((value) => value === index ? null : index)}
                      title={`${count} lojas ainda faltam ${step.toLowerCase()}`}
                    >
                      <span>{step}</span>
                      <em>{count}</em>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {agendaOpen ? (
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
          !dashboardOpen && (
            <div className="workspace">
              <ClientList
                title={
                  selectedStepFilter === null
                    ? "Seus clientes"
                    : `Sem ${STEPS[selectedStepFilter]}`
                }
                search={search}
                onSearch={setSearch}
                clients={visible}
                selectedId={selectedId}
                onSelect={setSelectedId}
                emptyText={
                  selectedStepFilter === null
                    ? emptyText
                    : `Nenhuma loja pendente em ${STEPS[selectedStepFilter].toLowerCase()}.`
                }
              />
              {renderRightPanel()}
            </div>
          )
        )}
      </main>

      {needSetup && (
        <SetupDialog
          initialName={me?.username ?? me?.name ?? ""}
          editing={!!me}
          busy={saving}
          onSubmit={login}
          onCancel={() => setNeedSetup(false)}
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

      {finishFor && (
        <FinishDialog
          clientName={finishFor.name}
          busy={saving}
          onCancel={() => setFinishFor(null)}
          onConfirm={finishClient}
        />
      )}

      <Toasts toasts={toasts} />
    </div>
  );
}
