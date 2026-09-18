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
  onSubmit: (name: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n) onSubmit(n);
  };

  return (
    <Modal
      label={editing ? "Editar meu nome" : "Entrar no checklist"}
      onClose={editing ? onCancel : undefined}
    >
      <div className="dialog-icon">
        <Users size={22} />
      </div>
      <h2>{editing ? "Como você aparece para a equipe" : "Quem é você?"}</h2>
      <p>
        Este checklist é colaborativo: cada pessoa entra com o próprio nome e
        todas as marcações aparecem para a equipe em tempo real.
      </p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="setup-name">
          Seu nome ou apelido
        </label>
        <input
          id="setup-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoFocus
          autoComplete="off"
          placeholder="Ex.: Ana Souza"
        />
        <div className="actions">
          {editing && onCancel && (
            <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
              Cancelar
            </button>
          )}
          <button className="primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? "Salvando…" : editing ? "Salvar" : "Entrar no checklist"}
          </button>
        </div>
      </form>
      <div className="setup-hint">
        <Users size={16} />
        <span>
          Para adicionar mais pessoas, compartilhe o link desta página — cada
          uma entra com o próprio nome.
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
