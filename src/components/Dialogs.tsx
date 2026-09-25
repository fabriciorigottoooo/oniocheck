"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Eye, EyeOff, NotebookPen, PenLine, Trash2, UserRoundPlus, Upload, Users } from "lucide-react";
import { activityParts, relTime } from "@/lib/format";
import Avatar from "./Avatar";

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

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="password-field-wrap">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="password-input-shell">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShow((current) => !current)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          title={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
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
          ? "Este checklist é colaborativo: cada pessoa entra com o próprio nome e todas as marcações ficam organizadas na equipe."
          : "Entre com seu nome de usuário e sua senha para acessar o checklist."}
      </p>
      <form onSubmit={submit} className="login-form">
        <div className="login-fieldset">
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
        </div>
        {!editing && (
          <PasswordField
            id="setup-password"
            label="Senha"
            value={password}
            onChange={setPassword}
            placeholder="Digite sua senha"
            autoComplete="current-password"
          />
        )}
        {!editing && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              const message = encodeURIComponent("Fabrício, esqueci minha senha. Poderia resetá-la, por favor?");
              window.open(`https://wa.me/5517988463129?text=${message}`, "_blank", "noopener,noreferrer");
            }}
          >
            Esqueci minha senha
          </button>
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
          Seu usuário e senha ficam salvos no banco de dados para acesso da equipe.
        </span>
      </div>
    </Modal>
  );
}

export function ClientDialog({
  mode,
  initialName = "",
  initialEconomicGroup = "",
  initialAttendanceUnit = "",
  initialPhone = "",
  busy,
  onCancel,
  onSubmit,
}: {
  mode: "new" | "rename";
  initialName?: string;
  initialEconomicGroup?: string;
  initialAttendanceUnit?: string;
  initialPhone?: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    name: string;
    economicGroup?: string | null;
    attendanceUnit?: string | null;
    phone?: string | null;
  }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [economicGroup, setEconomicGroup] = useState(initialEconomicGroup);
  const [attendanceUnit, setAttendanceUnit] = useState(initialAttendanceUnit);
  const [phone, setPhone] = useState(initialPhone);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n) {
      onSubmit({
        name: n,
        economicGroup: economicGroup.trim() || null,
        attendanceUnit: attendanceUnit.trim() || null,
        phone: phone.trim() || null,
      });
    }
  };

  return (
    <Modal label={mode === "new" ? "Novo cliente" : "Editar cliente"} onClose={onCancel}>
      <div className="dialog-icon">
        {mode === "new" ? <UserRoundPlus size={22} /> : <PenLine size={20} />}
      </div>
      <h2>{mode === "new" ? "Novo cliente" : "Editar cliente"}</h2>
      <p>
        {mode === "new"
          ? "Cadastre o cliente e vincule o grupo econômico e a unidade de atendimento."
          : "Atualize os dados do cliente e mantenha tudo vinculado ao grupo econômico."}
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

        <label className="field-label" htmlFor="client-economic-group">
          Grupo econômico
        </label>
        <input
          id="client-economic-group"
          type="text"
          value={economicGroup}
          onChange={(e) => setEconomicGroup(e.target.value)}
          maxLength={80}
          placeholder="Ex.: Grupo Onio"
          autoComplete="off"
        />

        <label className="field-label" htmlFor="client-attendance-unit">
          Unidade de atendimento
        </label>
        <input
          id="client-attendance-unit"
          type="text"
          value={attendanceUnit}
          onChange={(e) => setAttendanceUnit(e.target.value)}
          maxLength={80}
          placeholder="Ex.: Unidade Centro"
          autoComplete="off"
        />

        <label className="field-label" htmlFor="client-phone">
          Telefone de contato
        </label>
        <input
          id="client-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={30}
          placeholder="Ex.: (11) 99999-9999"
          autoComplete="tel"
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

export function ClientNotesDialog({
  clientName,
  initialNotes = "",
  busy,
  onCancel,
  onSubmit,
}: {
  clientName: string;
  initialNotes?: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(notes.trim());
  };

  return (
    <Modal label="Observações do cliente" onClose={onCancel}>
      <div className="dialog-icon">
        <NotebookPen size={22} />
      </div>
      <h2>Observações sobre {clientName}</h2>
      <p>Escreva qualquer detalhe útil para a equipe e mantenha essa informação disponível para consultas futuras.</p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="client-notes">
          Observações
        </label>
        <textarea
          id="client-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={8}
          placeholder="Ex.: Preferência de contato, observações da visita, dados relevantes do cliente..."
        />
        <div className="actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar observações"}
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

export function ProfileDialog({
  currentUsername,
  currentDisplayName,
  currentAvatarUrl,
  busy,
  onCancel,
  onSubmit,
}: {
  currentUsername: string;
  currentDisplayName: string;
  currentAvatarUrl: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (payload: { password?: string; displayName?: string | null; avatarUrl?: string | null }) => void;
}) {
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(currentDisplayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(currentDisplayName ?? "");
    setAvatarUrl(currentAvatarUrl ?? "");
  }, [currentDisplayName, currentAvatarUrl]);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = typeof reader.result === "string" ? reader.result : "";
      setAvatarUrl(next);
    };
    reader.readAsDataURL(file);
  };

  const clearAvatar = () => setAvatarUrl("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      password: password.trim() || undefined,
      displayName: displayName.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
    });
  };

  return (
    <Modal label="Configurar perfil" onClose={onCancel}>
      <div className="dialog-icon">
        <Users size={22} />
      </div>
      <h2>Perfil do usuário</h2>
      <p>Atualize seu nome de exibição, sua senha e escolha uma foto para aparecer na equipe.</p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="profile-username">
          Nome de usuário
        </label>
        <input id="profile-username" type="text" value={currentUsername} disabled />

        <label className="field-label" htmlFor="profile-display-name">
          Nome de exibição
        </label>
        <input
          id="profile-display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          placeholder="Deixe em branco para usar o nome de usuário"
          autoComplete="nickname"
        />

        <PasswordField
          id="profile-password"
          label="Nova senha"
          value={password}
          onChange={setPassword}
          placeholder="Deixe em branco para manter a atual"
          autoComplete="new-password"
        />

        <div className="profile-upload-wrap">
          <label className="field-label">Foto de perfil</label>
          <div className="profile-upload-row">
            <button
              type="button"
              className="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <Upload size={14} /> Selecionar arquivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFile}
            />
            {avatarUrl && (
              <img src={avatarUrl} alt="Preview do perfil" className="profile-upload-preview" />
            )}
            {avatarUrl && (
              <button type="button" className="secondary" onClick={clearAvatar} disabled={busy}>
                Remover foto
              </button>
            )}
          </div>
          <small className="field-help">A imagem fica salva no perfil do usuário e é exibida para a equipe. Use “Remover foto” para voltar ao avatar padrão.</small>
        </div>

        <div className="actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Fechar
          </button>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar perfil"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AgendaTypeDialog({
  mode,
  initialName = "",
  initialColor = "#2d6fe8",
  busy,
  onCancel,
  onConfirm,
  onDelete,
}: {
  mode: "create" | "edit";
  initialName?: string;
  initialColor?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (name: string, color: string) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);

  useEffect(() => {
    setName(initialName);
    setColor(initialColor);
  }, [initialName, initialColor]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = name.trim();
    if (!cleaned) return;
    onConfirm(cleaned, color);
  };

  return (
    <Modal label={mode === "create" ? "Criar tipo de evento" : "Editar tipo de evento"} onClose={onCancel}>
      <div className="dialog-icon">
        <Users size={22} />
      </div>
      <h2>{mode === "create" ? "Novo tipo de evento" : "Editar tipo de evento"}</h2>
      <p>
        {mode === "create"
          ? "Antes de confirmar, a criação desse tipo fica bloqueada apenas para esse passo de validação."
          : "Atualize o nome e a cor do tipo para manter a agenda organizada."}
      </p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="agenda-type-name">
          Nome do tipo
        </label>
        <input
          id="agenda-type-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoFocus
          placeholder="Ex.: Reunião de BM"
        />

        <label className="field-label" htmlFor="agenda-type-color">
          Cor
        </label>
        <div className="agenda-color-row">
          <input
            id="agenda-type-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Cor do tipo de evento"
          />
          <span>{color}</span>
        </div>

        <div className="actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          {mode === "edit" && onDelete && (
            <button type="button" className="danger" onClick={onDelete} disabled={busy}>
              <Trash2 size={14} /> Excluir
            </button>
          )}
          <button className="primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? "Salvando…" : mode === "create" ? "Criar tipo" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AgendaEventDialog({
  typeOptions = [],
  initialTitle = "",
  initialTypeId = "",
  initialDate = "",
  initialStartTime = "09:00",
  initialEndTime = "10:00",
  initialNotes = "",
  initialFinished = false,
  busy,
  onCancel,
  onDelete,
  onSubmit,
}: {
  typeOptions?: Array<{ id: string; name: string; color: string }>;
  initialTitle?: string;
  initialTypeId?: string;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialNotes?: string;
  initialFinished?: boolean;
  busy: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  onSubmit: (payload: {
    title: string;
    typeId: string;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string | null;
    finished?: boolean;
  }) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [typeId, setTypeId] = useState(initialTypeId);
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [notes, setNotes] = useState(initialNotes);
  const [finished, setFinished] = useState(initialFinished);

  useEffect(() => {
    setTitle(initialTitle);
    setTypeId(initialTypeId);
    setDate(initialDate);
    setStartTime(initialStartTime);
    setEndTime(initialEndTime);
    setNotes(initialNotes);
    setFinished(initialFinished);
  }, [initialTitle, initialTypeId, initialDate, initialStartTime, initialEndTime, initialNotes, initialFinished]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !typeId || !date || !startTime || !endTime) return;
    const safeEndTime = endTime <= startTime ? (() => {
      const [hour, minute] = startTime.split(":").map(Number);
      const next = new Date();
      next.setHours(hour, minute, 0, 0);
      next.setHours(next.getHours() + 1);
      return `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`;
    })() : endTime;
    onSubmit({ title, typeId, date, startTime, endTime: safeEndTime, notes: notes.trim() || null, finished });
  };

  return (
    <Modal label="Editar evento agendado" onClose={onCancel}>
      <div className="dialog-icon">
        <PenLine size={22} />
      </div>
      <h2>Editar evento</h2>
      <p>Atualize o nome, horário, tipo ou observações deste evento.</p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="agenda-event-title">Título</label>
        <input id="agenda-event-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} autoFocus />

        <label className="field-label" htmlFor="agenda-event-type">Tipo</label>
        <select id="agenda-event-type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Selecione</option>
          {typeOptions.map((type) => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </select>

        <div className="agenda-grid">
          <label>
            <span>Dia</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span>Início</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label>
            <span>Fim</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>

        <label className="field-label" htmlFor="agenda-event-notes">Observações</label>
        <textarea id="agenda-event-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Detalhes do evento..." />

        <div className="actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
          {onDelete && (
            <button type="button" className="danger" onClick={onDelete} disabled={busy}>
              <Trash2 size={14} /> Excluir
            </button>
          )}
          <button className="primary" type="submit" disabled={busy || !title.trim() || !typeId || !date || !startTime || !endTime}>
            {busy ? "Salvando…" : "Salvar evento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CollaboratorDetailDialog({
  collaborator,
  now,
  onClose,
}: {
  collaborator: { id: string; name: string; displayName?: string | null; color: string; avatarUrl?: string | null; lastSeenAt: string };
  now: number;
  onClose: () => void;
}) {
  const status = Date.now() - new Date(collaborator.lastSeenAt).getTime() < 45_000 ? "online" : "offline";
  const displayName = collaborator.displayName?.trim() ? collaborator.displayName.trim() : collaborator.name;

  return (
    <Modal label={`Detalhes de ${displayName}`} onClose={onClose}>
      <div className="dialog-icon">
        <Users size={22} />
      </div>
      <h2>{displayName}</h2>
      <p>Detalhes do colaborador da equipe.</p>
      <div className="collab-modal-card">
        <div className="collab-modal-identity">
          {collaborator.avatarUrl ? (
            <img src={collaborator.avatarUrl} alt={displayName} className="profile-upload-preview" />
          ) : (
            <div
              className="avatar avatar-photo"
              style={{ width: 52, height: 52, background: collaborator.color, fontSize: 18 }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <strong>{displayName}</strong>
            <span className={`status-pill ${status === "online" ? "online" : "offline"}`}>
              {status === "online" ? "Online agora" : "Offline"}
            </span>
          </div>
        </div>
        <div className="detail-mini-card">
          <div className="detail-mini-icon">
            <Users size={18} />
          </div>
          <div>
            <strong>Última atividade</strong>
            <p>{new Date(collaborator.lastSeenAt).toLocaleString("pt-BR")}</p>
          </div>
        </div>
        <div className="detail-mini-card">
          <div className="detail-mini-icon">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <strong>Status</strong>
            <p>{status === "online" ? "Disponível para colaborar no momento." : "Não está ativo neste momento."}</p>
          </div>
        </div>
      </div>
      <div className="actions">
        <button type="button" className="secondary" onClick={onClose}>
          Fechar
        </button>
      </div>
    </Modal>
  );
}

export function TeamModal({
  collaborators,
  meId,
  now,
  onSelect,
  onClose,
}: {
  collaborators: { id: string; name: string; displayName?: string | null; color: string; avatarUrl?: string | null; lastSeenAt: string }[];
  meId: string | null;
  now: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal label="Equipe" onClose={onClose}>
      <div className="dialog-icon"><Users size={22} /></div>
      <h2>Equipe</h2>
      <p>Veja quem está online e acesse os detalhes do time.</p>
      <div className="modal-list compact">
        {collaborators.map((person) => {
          const isOnline = Date.now() - new Date(person.lastSeenAt).getTime() < 45_000;
          const displayName = person.displayName?.trim() ? person.displayName.trim() : person.name;
          return (
            <button key={person.id} type="button" className="modal-row" onClick={() => onSelect(person.id)}>
              <Avatar
                name={displayName}
                color={person.color}
                size={34}
                online={isOnline}
                imageUrl={person.avatarUrl ?? null}
                lightBorder
              />
              <span className="modal-row-main">
                <strong>{displayName}</strong>
                <small>{isOnline ? "Online agora" : "Offline"}{person.id === meId ? " · você" : ""}</small>
              </span>
            </button>
          );
        })}
      </div>
      <div className="actions">
        <button type="button" className="secondary" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
}

export function ActivityModal({
  activities,
  now,
  onClose,
}: {
  activities: Array<{ id: string; actorName: string; actorColor: string; action: string; clientName: string; detail: string | null; createdAt: string }>;
  now: number;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Modal label="Atividade recente" onClose={onClose}>
      <div className="modal-header-inline">
        <div className="dialog-icon"><CheckCircle2 size={22} /></div>
        <div className="modal-header-copy">
          <h2>Atividade recente</h2>
          <p>Últimas ações da equipe sincronizadas em tempo real.</p>
        </div>
      </div>

      <div className="modal-toolbar">
        <button type="button" className="secondary" onClick={onClose}>Fechar</button>
        {activities.length > 0 && (
          <button type="button" className="secondary" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Contrair" : "Ver mais"}
          </button>
        )}
      </div>

      <div className={`modal-list compact ${expanded ? "expanded" : "collapsed"}`}>
        {activities.length ? activities.map((item) => {
          const { actor, msg } = activityParts({
            ...item,
            actorId: "",
            actorName: item.actorName,
            actorColor: item.actorColor,
            clientId: null,
            clientName: item.clientName,
            action: item.action,
            detail: item.detail,
            createdAt: item.createdAt,
          } as any);
          return (
            <div key={item.id} className="modal-row static">
              <span className="user-bullet" style={{ background: item.actorColor }} />
              <span className="modal-row-main">
                <strong>{actor}</strong>
                <small>{msg}</small>
                <time>{relTime(item.createdAt, now)}</time>
              </span>
            </div>
          );
        }) : <p className="empty">Nenhuma atividade recente.</p>}
      </div>
    </Modal>
  );
}

export function AdminDialog({
  collaborators,
  busy,
  onDelete,
  onResetPassword,
  onClose,
}: {
  collaborators: { id: string; name: string }[];
  busy: boolean;
  onDelete: (id: string) => void;
  onResetPassword: (payload: { collaboratorId: string; password: string; confirmPassword: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [resetOpen, setResetOpen] = useState(false);

  const openReset = (personId: string) => {
    setSelectedId(personId);
    setResetOpen(true);
  };

  const closeReset = () => {
    setResetOpen(false);
    setSelectedId("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password === "admin") {
      setAuthorized(true);
      setError("");
      return;
    }
    setError("Senha incorreta.");
  };

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setResetError("");
    setResetSuccess("");

    try {
      await onResetPassword({
        collaboratorId: selectedId,
        password: newPassword,
        confirmPassword,
      });
      setResetSuccess("Senha redefinida com sucesso.");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        closeReset();
      }, 700);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    }
  };

  return (
    <>
    <Modal label="Acesso administrativo" onClose={onClose}>
      <div className="dialog-icon">
        <Users size={22} />
      </div>
      <h2>Área administrativa</h2>
      {!authorized ? (
        <form onSubmit={submit}>
          <PasswordField
            id="admin-password"
            label="Senha do administrador"
            value={password}
            onChange={setPassword}
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
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => openReset(person.id)}
                      disabled={busy}
                    >
                      Resetar senha
                    </button>
                    <button
                      type="button"
                      className="secondary danger-inline"
                      onClick={() => onDelete(person.id)}
                      disabled={busy}
                    >
                      Excluir
                    </button>
                  </div>
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

    {resetOpen && selectedId && (
      <Modal label="Redefinir senha" onClose={closeReset}>
        <div className="dialog-icon">
          <Users size={22} />
        </div>
        <h2>Redefinir senha</h2>
        <p>Defina a nova senha para o colaborador selecionado.</p>
        <form onSubmit={handleReset} className="admin-password-reset">
          <PasswordField
            id="admin-reset-password"
            label="Nova senha"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Digite a nova senha"
          />
          <PasswordField
            id="admin-reset-confirm"
            label="Confirmar nova senha"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Repita a nova senha"
          />
          {resetError && <p className="field-error">{resetError}</p>}
          {resetSuccess && <p className="field-success">{resetSuccess}</p>}
          <div className="actions">
            <button type="button" className="secondary" onClick={closeReset} disabled={busy}>
              Cancelar
            </button>
            <button className="primary" type="submit" disabled={busy || !newPassword.trim() || !confirmPassword.trim()}>
              {busy ? "Salvando…" : "Salvar nova senha"}
            </button>
          </div>
        </form>
      </Modal>
    )}
    </>
  );
}
