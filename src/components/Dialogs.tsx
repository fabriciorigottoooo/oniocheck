"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, PenLine, Trash2, UserRoundPlus, Upload, Users } from "lucide-react";

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
          ? "Este checklist é colaborativo: cada pessoa entra com o próprio nome e todas as marcações ficam organizadas na equipe."
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
  currentName,
  currentAvatarUrl,
  busy,
  onCancel,
  onSubmit,
}: {
  currentName: string;
  currentAvatarUrl: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (payload: { password?: string; avatarUrl?: string | null }) => void;
}) {
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarUrl(currentAvatarUrl ?? "");
  }, [currentAvatarUrl]);

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
      avatarUrl: avatarUrl.trim() || null,
    });
  };

  return (
    <Modal label="Configurar perfil" onClose={onCancel}>
      <div className="dialog-icon">
        <Users size={22} />
      </div>
      <h2>Perfil do usuário</h2>
      <p>Atualize sua senha e escolha uma foto para aparecer na equipe.</p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="profile-name">
          Nome atual
        </label>
        <input id="profile-name" type="text" value={currentName} disabled />

        <label className="field-label" htmlFor="profile-password">
          Nova senha
        </label>
        <input
          id="profile-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
  }) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [typeId, setTypeId] = useState(initialTypeId);
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    setTitle(initialTitle);
    setTypeId(initialTypeId);
    setDate(initialDate);
    setStartTime(initialStartTime);
    setEndTime(initialEndTime);
    setNotes(initialNotes);
  }, [initialTitle, initialTypeId, initialDate, initialStartTime, initialEndTime, initialNotes]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !typeId || !date || !startTime || !endTime) return;
    onSubmit({ title, typeId, date, startTime, endTime, notes: notes.trim() || null });
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
  collaborator: { id: string; name: string; color: string; avatarUrl?: string | null; lastSeenAt: string };
  now: number;
  onClose: () => void;
}) {
  const status = Date.now() - new Date(collaborator.lastSeenAt).getTime() < 45_000 ? "online" : "offline";

  return (
    <Modal label={`Detalhes de ${collaborator.name}`} onClose={onClose}>
      <div className="dialog-icon">
        <Users size={22} />
      </div>
      <h2>{collaborator.name}</h2>
      <p>Detalhes do colaborador da equipe.</p>
      <div className="collab-modal-card">
        <div className="collab-modal-identity">
          {collaborator.avatarUrl ? (
            <img src={collaborator.avatarUrl} alt={collaborator.name} className="profile-upload-preview" />
          ) : (
            <div
              className="avatar avatar-photo"
              style={{ width: 52, height: 52, background: collaborator.color, fontSize: 18 }}
            >
              {collaborator.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <strong>{collaborator.name}</strong>
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
