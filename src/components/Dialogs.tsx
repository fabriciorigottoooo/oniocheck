"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, PenLine, UserRoundPlus, Users } from "lucide-react";

function Modal({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

export function SetupDialog({
  initialName = "",
  editing = false,
  busy,
  onSubmit,
  onCancel,
}: {
  initialName?: string;
  editing?: boolean;
  busy: boolean;
  onSubmit: (username: string, password: string) => void;
  onCancel?: () => void;
}) {
  const [username, setUsername] = useState(initialName);
  const [password, setPassword] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (!u) return;
    if (!editing && !password.trim()) return;
    onSubmit(u, password);
  };

  return (
    <Modal
      label={editing ? "Editar meu nome" : "Entrar no checklist"}
      onClose={editing ? onCancel : undefined}
    >
      <div className="dialog-icon">
        <Users size={22} />
      </div>
      <h2>{editing ? "Como você aparece para a equipe" : "Login no checklist"}</h2>
      <p>
        {editing
          ? "Este checklist é colaborativo: cada pessoa entra com o próprio nome e todas as marcações aparecem para a equipe em tempo real."
          : "Entre com seu nome de usuário e sua senha para acessar o checklist."}
      </p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="setup-name">
          Nome de usuário
        </label>
        <input
          id="setup-name"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={40}
          autoFocus
          autoComplete="off"
          placeholder="Ex.: ana.souza"
        />
        {!editing && (
          <>
            <label className="field-label" htmlFor="setup-password">
              Senha
            </label>
            <input
              id="setup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={50}
              autoComplete="current-password"
              placeholder="Digite sua senha"
            />
          </>
        )}
        <div className="actions">
          {editing && onCancel && (
            <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
              Cancelar
            </button>
          )}
          <button
            className="primary"
            type="submit"
            disabled={busy || !username.trim() || (!editing && !password.trim())}
          >
            {busy ? "Entrando…" : editing ? "Salvar" : "Entrar"}
          </button>
        </div>
      </form>
      <div className="setup-hint">
        <Users size={16} />
        <span>
          Seu usuário e senha ficam salvos no banco de dados e o acesso é
          compartilhado em tempo real com a equipe.
        </span>
      </div>
    </Modal>
  );
}

export function ClientDialog({
  mode,
  initialName = "",
  busy,
  onCancel,
  onSubmit,
}: {
  mode: "new" | "rename";
  initialName?: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n) onSubmit(n);
  };

  return (
    <Modal label={mode === "new" ? "Novo cliente" : "Editar nome"} onClose={onCancel}>
      <div className="dialog-icon">
        {mode === "new" ? <UserRoundPlus size={22} /> : <PenLine size={20} />}
      </div>
      <h2>{mode === "new" ? "Novo cliente" : "Editar nome"}</h2>
      <p>
        {mode === "new"
          ? "O checklist de 10 etapas será criado automaticamente e a equipe será avisada."
          : "O novo nome aparece imediatamente para toda a equipe."}
      </p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="client-name">
          Nome do cliente
        </label>
        <input
          id="client-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoFocus
          autoComplete="off"
        />
        <div className="actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button className="primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function FinishDialog({
  clientName,
  busy,
  onCancel,
  onConfirm,
}: {
  clientName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal label="Finalizar cliente" onClose={onCancel}>
      <div className="dialog-icon">
        <CheckCircle2 size={24} />
      </div>
      <h2>Tudo pronto para finalizar?</h2>
      <p>
        Todas as 10 etapas de <strong>{clientName}</strong> foram marcadas.
      </p>
      <p>
        Ao confirmar, o cliente será movido para a tela de Finalizados, onde
        poderá ser consultado — e reaberto, se necessário.
      </p>
      <div className="actions">
        <button className="secondary" onClick={onCancel} disabled={busy}>
          Agora não
        </button>
        <button className="primary" onClick={onConfirm} disabled={busy}>
          {busy ? "Finalizando…" : "Sim, finalizar"}
        </button>
      </div>
    </Modal>
  );
}

export function AdminDialog({
  collaborators,
  busy,
  onDelete,
  onClose,
}: {
  collaborators: { id: string; name: string }[];
  busy: boolean;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password === "admin") {
      setAuthorized(true);
      setError("");
      return;
    }
    setError("Senha incorreta.");
  };

  return (
    <Modal label="Acesso administrativo" onClose={onClose}>
      <div className="dialog-icon">
        <Users size={22} />
      </div>
      <h2>Área administrativa</h2>
      {!authorized ? (
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="admin-password">
            Senha do administrador
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="Digite a senha"
          />
          {error && <p className="field-error">{error}</p>}
          <div className="actions">
            <button type="button" className="secondary" onClick={onClose} disabled={busy}>
              Fechar
            </button>
            <button className="primary" type="submit" disabled={busy || !password.trim()}>
              {busy ? "Verificando…" : "Entrar"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p>Você entrou com sucesso. Ações disponíveis:</p>
          <div className="admin-list">
            {collaborators.length ? (
              collaborators.map((person) => (
                <div key={person.id} className="admin-row">
                  <span>{person.name}</span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onDelete(person.id)}
                    disabled={busy}
                  >
                    Excluir
                  </button>
                </div>
              ))
            ) : (
              <p>Nenhum colaborador cadastrado.</p>
            )}
          </div>
          <div className="actions">
            <button className="secondary" onClick={onClose} disabled={busy}>
              Fechar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
