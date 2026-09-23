"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Clock3,
  MoonStar,
  NotebookPen,
  PencilLine,
  Plus,
  SunMedium,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
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
  AdminDialog,
  AgendaEventDialog,
  AgendaTypeDialog,
  ClientDialog,
  CollaboratorDetailDialog,
  FinishDialog,
  ProfileDialog,
  SetupDialog,
} from "./Dialogs";
import Toasts, { type ToastItem } from "./Toasts";
import Avatar from "./Avatar";

const ME_KEY = "oniocheck-me-v1";
const CLIENT_BACKUP_KEY = "oniocheck-client-backup-v1";

type Me = {
  id: string;
  name: string;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [clientDialog, setClientDialog] = useState<
    { mode: "new" } | { mode: "rename"; client: ClientT } | null
  >(null);
  const [finishFor, setFinishFor] = useState<ClientT | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [teamOpen, setTeamOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
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
  });
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const fileRef = useRef<HTMLInputElement>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meRef = useRef<Me | null>(null);

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
        if (evt.type === "change" || evt.type === "presence") scheduleRefetch();
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

  const activeClients = useMemo(
    () => (clients ?? []).filter((c) => !c.finishedAt),
    [clients],
  );
  const doneClients = useMemo(
    () =>
      (clients ?? [])
        .filter((c) => c.finishedAt)
        .slice()
        .sort(
          (a, b) =>
            Date.parse(b.finishedAt as string) - Date.parse(a.finishedAt as string),
        ),
    [clients],
  );
  const visible = useMemo(() => {
    const q = norm(search.trim());
    const list = view === "active" ? activeClients : doneClients;
    return q ? list.filter((c) => norm(c.name).includes(q)) : list;
  }, [view, search, activeClients, doneClients]);

  const selected =
    (clients ?? []).find((c) => c.id === selectedId) ??
    visible[0] ??
    null;
  const onlineCollabs = collaborators.filter((c) => isOnline(c, now));
  const stepsDone = activeClients.reduce((n, c) => n + stepTotal(c), 0);
  const selectedCollaborator =
    collaborators.find((c) => c.id === selectedCollaboratorId) ?? null;
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
    setAgendaOpen(false);
    setSearch("");
    setSelectedId(null);
    setSelectedCollaboratorId(null);
  };

  const openAgenda = () => {
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
    setSaving(true);
    try {
      await api.deleteAgendaType(type.id, { actor: { id: me.id, name: me.name } });
      setAgendaForm((prev) => ({ ...prev, typeId: prev.typeId === type.id ? "" : prev.typeId }));
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
  }) => {
    if (!me) return;
    setSaving(true);
    try {
      await api.updateAgendaEvent(eventId, {
        title: payload.title.trim(),
        typeId: payload.typeId,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        notes: payload.notes?.trim() || null,
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
    setSaving(true);
    try {
      await api.deleteAgendaEvent(event.id, { actor: { id: me.id, name: me.name } });
      setAgendaEventDialog(null);
      await fetchState();
      pushToast("Evento removido.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível excluir o evento."));
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
    setSaving(true);
    try {
      await api.createAgendaEvent({
        title: cleaned,
        typeId,
        date: agendaForm.date,
        startTime: agendaForm.startTime,
        endTime: agendaForm.endTime,
        notes: agendaForm.notes.trim() || null,
        actor: { id: me.id, name: me.name },
      });
      setAgendaForm({
        title: "",
        typeId: agendaTypes[0]?.id ?? "",
        date: new Date().toISOString().slice(0, 10),
        startTime: "09:00",
        endTime: "10:00",
        notes: "",
      });
      await fetchState();
      pushToast("Evento agendado com sucesso.");
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível agendar o evento."));
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = async ({ password, avatarUrl }: { password?: string; avatarUrl?: string | null }) => {
    const meNow = meRef.current;
    if (!meNow) return;
    setSaving(true);
    try {
      const { collaborator } = await api.updateProfile({
        id: meNow.id,
        username: meNow.username,
        password: password && password.trim() ? password.trim() : undefined,
        avatarUrl: avatarUrl && avatarUrl.trim() ? avatarUrl.trim() : null,
      });
      const nextMe = { ...meNow, name: collaborator.name, color: collaborator.color };
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
        name: collaborator.name,
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
  }: {
    name: string;
    economicGroup?: string | null;
    attendanceUnit?: string | null;
    phone?: string | null;
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

  const deleteCollaborator = async (id: string) => {
    const meNow = meRef.current;
    if (!meNow) return;
    if (!window.confirm("Deseja excluir este colaborador?")) return;
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

  const booting = !me && !needSetup;

  const agendaTitle = agendaOpen ? "Agenda" : view === "active" ? "Em andamento" : "Finalizados";

  const renderRightPanel = () => (
    <ClientDetail
      client={selected}
      onToggle={(i, v) => selected && toggleStep(selected, i, v)}
      onRename={() => selected && setClientDialog({ mode: "rename", client: selected })}
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
        onView={changeView}
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
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        onToggleTeam={() => setTeamOpen((value) => !value)}
        onToggleActivity={() => setActivityOpen((value) => !value)}
        onEditIdentity={() => setNeedSetup(true)}
        onOpenAdmin={() => setAdminOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onSelectCollaborator={setSelectedCollaboratorId}
      />

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">GESTÃO DE CHECKLISTS · COLABORATIVO</div>
            <h1>{agendaTitle}</h1>
            <p className="muted">
              {agendaOpen
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
            <button className="primary" onClick={() => setClientDialog({ mode: "new" })}>
              <Plus size={15} /> Novo cliente
            </button>
          </div>
        </header>

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
                />
              ))}
              {onlineCollabs.length > 6 && (
                <span className="stack-more">+{onlineCollabs.length - 6}</span>
              )}
            </div>
          </div>
        </section>

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
                      onChange={(e) => setAgendaForm((prev) => ({ ...prev, startTime: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Fim</span>
                    <input
                      type="time"
                      value={agendaForm.endTime}
                      onChange={(e) => setAgendaForm((prev) => ({ ...prev, endTime: e.target.value }))}
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
                      <div key={event.id} className="agenda-event-card">
                        <div className="agenda-event-header">
                          <span className="agenda-event-type" style={{ background: `${type.color}18`, color: type.color }}>
                            {type.name}
                          </span>
                          <div className="agenda-event-actions">
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
                        <small>Organizador: {event.organizerName}</small>
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
          <div className="workspace">
            <ClientList
              title="Seus clientes"
              search={search}
              onSearch={setSearch}
              clients={visible}
              selectedId={selectedId}
              onSelect={setSelectedId}
              emptyText={emptyText}
            />
            {renderRightPanel()}
          </div>
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
          onClose={() => setAdminOpen(false)}
        />
      )}

      {profileOpen && (
        <ProfileDialog
          currentName={me?.name ?? ""}
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

      {selectedCollaborator && (
        <CollaboratorDetailDialog
          collaborator={selectedCollaborator}
          now={now}
          onClose={() => setSelectedCollaboratorId(null)}
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
          busy={saving}
          onCancel={() => setAgendaEventDialog(null)}
          onDelete={() => void deleteAgendaEvent(agendaEventDialog.event)}
          onSubmit={(payload: { title: string; typeId: string; date: string; startTime: string; endTime: string; notes?: string | null; }) => void updateAgendaEvent(agendaEventDialog.event.id, payload)}
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
