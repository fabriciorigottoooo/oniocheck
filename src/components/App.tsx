"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { api } from "@/lib/api";
import {
  activityParts,
  isOnline,
  norm,
  stepTotal,
} from "@/lib/format";
import type { Activity, AppState, ClientT } from "@/lib/types";
import Sidebar from "./Sidebar";
import ClientList from "./ClientList";
import ClientDetail from "./ClientDetail";
import {
  AdminDialog,
  ClientDialog,
  FinishDialog,
  SetupDialog,
} from "./Dialogs";
import Toasts, { type ToastItem } from "./Toasts";
import Avatar from "./Avatar";

const ME_KEY = "checkflow-me-v1";

type Me = {
  id: string;
  name: string;
  color: string;
  username: string;
  role: string;
};

let toastSeq = 1;

export default function App() {
  const [data, setData] = useState<AppState | null>(null);
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
      setData(s);
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
            setMe({
              id: p.id,
              name: p.name,
              color: p.color ?? "#2a9b81",
              username: p.username ?? p.name,
              role: p.role ?? "user",
            });
            return;
          }
        }
      } catch {
        // identidade corrompida -> pede novamente
      }
      setNeedSetup(true);
      await fetchState();
    };

    void bootstrap();
  }, [fetchState]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

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

  /* ---------- actions ---------- */

  const changeView = (v: "active" | "done") => {
    setView(v);
    setSearch("");
    setSelectedId(null);
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
          : `Bem-vindo(a), ${user.username}! Suas marcações aparecem para todos.`,
      );
      void fetchState();
    } catch (e) {
      pushToast(errMsg(e, "Não foi possível entrar. Verifique usuário e senha."));
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

  const createClient = async (name: string) => {
    const meNow = meRef.current;
    if (!meNow) return;
    setSaving(true);
    try {
      const { client } = await api.createClient({
        name,
        actor: { id: meNow.id, name: meNow.name },
      });
      setData((prev) =>
        prev ? { ...prev, clients: [...prev.clients, client] } : prev,
      );
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

  const renameClient = async (name: string) => {
    const meNow = meRef.current;
    if (!meNow || !clientDialog || clientDialog.mode !== "rename") return;
    const target = clientDialog.client;
    setSaving(true);
    try {
      const { client } = await api.patchClient(target.id, {
        op: "rename",
        name,
        actor: { id: meNow.id, name: meNow.name },
      });
      replaceClient(client);
      setClientDialog(null);
      pushToast("Nome atualizado.");
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

  if (!data) {
    return (
      <div className="loading-screen">
        <div className="brand xl">
          check<span>flow.</span>
        </div>
        <div className="loading-bar">
          <i />
        </div>
        <p>Conectando ao servidor…</p>
        {needSetup && <SetupDialog busy={saving} onSubmit={login} />}
      </div>
    );
  }

  const emptyText = search.trim()
    ? "Nenhum cliente encontrado."
    : view === "done"
      ? "Seus clientes finalizados aparecerão aqui."
      : "Nenhum cliente em andamento.";

  return (
    <div className="app">
      <Sidebar
        view={view}
        counts={{ active: activeClients.length, done: doneClients.length }}
        onView={changeView}
        collaborators={collaborators}
        activities={activities}
        meId={me?.id ?? null}
        now={now}
        onEditIdentity={() => setNeedSetup(true)}
        onOpenAdmin={() => setAdminOpen(true)}
      />

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">GESTÃO DE CHECKLISTS · COLABORATIVO</div>
            <h1>{view === "active" ? "Em andamento" : "Finalizados"}</h1>
            <p className="muted">
              {view === "active"
                ? "Cada etapa marcada é um passo a menos — e a equipe inteira vê na hora."
                : "Histórico de clientes com todas as etapas concluídas."}
            </p>
          </div>
          <div className="top-actions">
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
          <ClientDetail
            client={selected}
            onToggle={(i, v) => selected && toggleStep(selected, i, v)}
            onRename={() => selected && setClientDialog({ mode: "rename", client: selected })}
            onFinish={() => selected && setFinishFor(selected)}
            onReopen={() => selected && reopenClient(selected)}
          />
        </div>

        <div className="footer">
          Dados iniciais transcritos da imagem. O nome de MultiDrogas aparece
          cortado na origem; use “Editar nome” para ajustá-lo. As cores da
          planilha não foram interpretadas como status.
          <br />
          Agora tudo é salvo no servidor e compartilhado com a equipe em tempo
          real — o que você marca aparece para todos, e o que todos marcam
          aparece para você.
          <br />
          <button className="secondary" onClick={exportBackup}>
            <Download size={12} /> Baixar backup JSON
          </button>
          <button className="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={12} /> Restaurar backup
          </button>
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
        </div>
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

      {clientDialog && (
        <ClientDialog
          mode={clientDialog.mode}
          initialName={clientDialog.mode === "rename" ? clientDialog.client.name : ""}
          busy={saving}
          onCancel={() => setClientDialog(null)}
          onSubmit={clientDialog.mode === "new" ? createClient : renameClient}
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
