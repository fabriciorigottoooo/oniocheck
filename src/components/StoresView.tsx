"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UnlockKeyhole,
  UserRound,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ActorInput, StoresVaultEnvelope } from "@/lib/types";

const KDF_ITERATIONS = 310_000;
const ROLES = ["Atendente", "Administrador", "Suporte"] as const;

type Role = (typeof ROLES)[number];
type StoreAccount = { id: string; role: Role; email: string; password: string };
type StoreRecord = {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  responsible: string;
  accounts: StoreAccount[];
  observations: string;
  createdAt: string;
  updatedAt: string;
};
type VaultPayload = { stores: StoreRecord[] };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

async function deriveVaultKey(password: string, salt: string) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromBase64(salt), iterations: KDF_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptVault(payload: VaultPayload, key: CryptoKey, salt: string): Promise<StoresVaultEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  return { version: 1, salt, iv: toBase64(iv), data: toBase64(new Uint8Array(encrypted)) };
}

async function decryptVaultWithKey(envelope: StoresVaultEnvelope, key: CryptoKey) {
  if (envelope.version !== 1 || !envelope.salt || !envelope.iv || !envelope.data) {
    throw new Error("Este backup não é válido ou não é compatível.");
  }
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.iv) },
    key,
    fromBase64(envelope.data),
  );
  const parsed = JSON.parse(decoder.decode(clear)) as Partial<VaultPayload>;
  if (!Array.isArray(parsed.stores)) throw new Error("O conteúdo do backup não é válido.");
  return parsed.stores as StoreRecord[];
}

async function decryptVault(envelope: StoresVaultEnvelope, password: string) {
  const key = await deriveVaultKey(password, envelope.salt);
  const stores = await decryptVaultWithKey(envelope, key);
  return { key, stores };
}

function newAccount(): StoreAccount {
  return { id: crypto.randomUUID(), role: "Atendente", email: "", password: "" };
}

function newStore(): StoreRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "",
    cnpj: "",
    phone: "",
    responsible: "",
    accounts: [newAccount()],
    observations: "",
    createdAt: now,
    updatedAt: now,
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function StoresView({ actor }: { actor: ActorInput }) {
  const [ready, setReady] = useState(false);
  const [hasVault, setHasVault] = useState(false);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [vaultSalt, setVaultSalt] = useState("");
  const [vaultEnvelope, setVaultEnvelope] = useState<StoresVaultEnvelope | null>(null);
  const [vaultRevision, setVaultRevision] = useState<string | null>(null);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [backupText, setBackupText] = useState("");
  const [showRestore, setShowRestore] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [formStore, setFormStore] = useState<StoreRecord | null>(null);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    api.getStoresVault().then(({ vault, revision }) => {
      if (!active) return;
      setVaultEnvelope(vault);
      setVaultRevision(revision);
      setHasVault(!!vault);
      setReady(true);
    }).catch((error: unknown) => {
      if (!active) return;
      setFeedback(errorMessage(error, "Não foi possível conectar ao cofre compartilhado."));
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!vaultKey) return;
    const events = new EventSource("/api/events");
    let active = true;
    const refresh = async () => {
      try {
        const { vault, revision } = await api.getStoresVault();
        if (!active || !vault) return;
        if (vault.iv === vaultEnvelope?.iv && vault.data === vaultEnvelope?.data) return;
        if (vault.salt !== vaultSalt) {
          setFeedback("O cofre foi restaurado com outra senha mestra por um membro da equipe. Bloqueie e desbloqueie com a senha atualizada para continuar.");
          return;
        }
        const updatedStores = await decryptVaultWithKey(vault, vaultKey);
        setVaultEnvelope(vault);
        setVaultRevision(revision);
        setStores(updatedStores);
        setSelectedId((current) => updatedStores.some((store) => store.id === current) ? current : updatedStores[0]?.id ?? null);
      } catch {
        // Uma mudança criptografada por outra senha pede desbloqueio manual, sem descartar o estado atual.
      }
    };
    events.onmessage = () => { void refresh(); };
    return () => { active = false; events.close(); };
  }, [vaultKey, vaultSalt, vaultEnvelope]);

  const selected = stores.find((store) => store.id === selectedId) ?? null;
  const filteredStores = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    if (!q) return stores;
    return stores.filter((store) =>
      [store.name, store.cnpj, ...store.accounts.map((account) => account.email)]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(q)),
    );
  }, [query, stores]);

  const unlock = async () => {
    setFeedback("");
    setBusy(true);
    try {
      const latest = await api.getStoresVault();
      const envelope = latest.vault;
      if (!envelope) throw new Error("Não encontrei um cofre compartilhado.");
      const unlocked = await decryptVault(envelope, password);
      setVaultKey(unlocked.key);
      setVaultSalt(envelope.salt);
      setVaultEnvelope(envelope);
      setVaultRevision(latest.revision);
      setStores(unlocked.stores);
      setSelectedId(unlocked.stores[0]?.id ?? null);
      setHasVault(true);
      setPassword("");
    } catch {
      setFeedback("Senha incorreta ou cofre inválido. Confira a senha mestra e tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const createVault = async () => {
    setFeedback("");
    if (password.length < 8) {
      setFeedback("Use pelo menos 8 caracteres na senha mestra.");
      return;
    }
    if (password !== confirmPassword) {
      setFeedback("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const latest = await api.getStoresVault();
      if (latest.vault) {
        setVaultEnvelope(latest.vault);
        setVaultRevision(latest.revision);
        setHasVault(true);
        setFeedback("Outro membro da equipe já criou o cofre compartilhado. Digite a senha mestra da equipe para desbloquear.");
        return;
      }
      const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
      const key = await deriveVaultKey(password, salt);
      const emptyVault = await encryptVault({ stores: [] }, key, salt);
      const saved = await api.saveStoresVault({ vault: emptyVault, expectedUpdatedAt: null, actor });
      setVaultKey(key);
      setVaultSalt(salt);
      setVaultEnvelope(emptyVault);
      setVaultRevision(saved.revision);
      setStores([]);
      setHasVault(true);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setFeedback(errorMessage(error, "Não foi possível criar o cofre neste navegador."));
    } finally {
      setBusy(false);
    }
  };

  const persist = async (nextStores: StoreRecord[], key = vaultKey, salt = vaultSalt) => {
    if (!key || !salt) throw new Error("Desbloqueie o cofre para salvar alterações.");
    const envelope = await encryptVault({ stores: nextStores }, key, salt);
    const saved = await api.saveStoresVault({ vault: envelope, expectedUpdatedAt: vaultRevision, actor });
    setVaultEnvelope(envelope);
    setVaultRevision(saved.revision);
    setStores(nextStores);
  };

  const saveStore = async () => {
    if (!formStore) return;
    const name = formStore.name.trim();
    if (!name) {
      setFeedback("Informe o nome da loja.");
      return;
    }
    const cleaned = {
      ...formStore,
      name,
      cnpj: formStore.cnpj.trim(),
      phone: formStore.phone.trim(),
      responsible: formStore.responsible.trim(),
      observations: formStore.observations.trim(),
      accounts: formStore.accounts.map((account) => ({
        ...account,
        email: account.email.trim(),
      })),
      updatedAt: new Date().toISOString(),
    };
    const nextStores = stores.some((store) => store.id === cleaned.id)
      ? stores.map((store) => (store.id === cleaned.id ? cleaned : store))
      : [cleaned, ...stores];
    setBusy(true);
    try {
      await persist(nextStores);
      setSelectedId(cleaned.id);
      setFormStore(null);
      setFeedback("");
    } catch (error) {
      setFeedback(errorMessage(error, "Não foi possível salvar a loja."));
    } finally {
      setBusy(false);
    }
  };

  const deleteStore = async (store: StoreRecord) => {
    if (!window.confirm(`Excluir o cadastro de “${store.name}”? Essa ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      const nextStores = stores.filter((item) => item.id !== store.id);
      await persist(nextStores);
      setSelectedId(nextStores[0]?.id ?? null);
      setFeedback("");
    } catch (error) {
      setFeedback(errorMessage(error, "Não foi possível excluir a loja."));
    } finally {
      setBusy(false);
    }
  };

  const lockVault = () => {
    setVaultKey(null);
    setVaultSalt("");
    setStores([]);
    setSelectedId(null);
    setQuery("");
    setRevealed([]);
    setFeedback("");
  };

  const importBackup = async () => {
    setFeedback("");
    setBusy(true);
    try {
      const envelope = JSON.parse(backupText.trim()) as StoresVaultEnvelope;
      const restored = await decryptVault(envelope, backupPassword);
      if (hasVault && !window.confirm("Importar este backup vai substituir os cadastros compartilhados da equipe. Deseja continuar?")) {
        return;
      }
      const saved = await api.saveStoresVault({ vault: envelope, expectedUpdatedAt: vaultRevision, actor });
      setHasVault(true);
      setVaultEnvelope(envelope);
      setVaultRevision(saved.revision);
      setVaultKey(restored.key);
      setVaultSalt(envelope.salt);
      setStores(restored.stores);
      setSelectedId(restored.stores[0]?.id ?? null);
      setBackupText("");
      setBackupPassword("");
      setShowRestore(false);
      setBackupOpen(false);
      setFeedback("");
    } catch (error) {
      setFeedback(errorMessage(error, "Não foi possível importar o backup. Verifique o texto e a senha."));
    } finally {
      setBusy(false);
    }
  };

  const openBackup = () => {
    setBackupText(vaultEnvelope ? JSON.stringify(vaultEnvelope) : "");
    setBackupPassword("");
    setFeedback("");
    setBackupOpen(true);
  };

  const copyBackup = async () => {
    try {
      await navigator.clipboard.writeText(backupText);
      setFeedback("Backup criptografado copiado.");
    } catch {
      setFeedback("Não foi possível acessar a área de transferência. Selecione e copie o texto manualmente.");
    }
  };

  const updateAccount = (accountId: string, patch: Partial<StoreAccount>) => {
    setFormStore((current) => current ? {
      ...current,
      accounts: current.accounts.map((account) => account.id === accountId ? { ...account, ...patch } : account),
    } : current);
  };

  if (!ready) return <section className="panel stores-loading">Preparando o cofre neste navegador…</section>;

  if (!vaultKey) {
    return (
      <section className="stores-gate panel">
        <div className="stores-gate-icon"><LockKeyhole size={24} /></div>
        <div className="stores-eyebrow">COFRE CRIPTOGRAFADO NO NAVEGADOR</div>
        <h2>{hasVault ? "Desbloquear Cadastros/Lojas" : showRestore ? "Restaurar backup" : "Criar senha mestra"}</h2>
        <p className="stores-gate-copy">
          {hasVault
          ? "Digite a senha mestra compartilhada para abrir os cadastros da equipe."
          : showRestore
              ? "Cole um backup criptografado e informe a senha mestra usada quando ele foi criado."
              : "Crie a senha mestra compartilhada que sua equipe usará para abrir o cofre. Não existe recuperação: se ela for esquecida e não houver um backup, os dados não poderão ser recuperados."}
        </p>

        {showRestore ? (
          <div className="stores-gate-form">
            <label className="stores-field stores-field-full">
              Backup criptografado
              <textarea value={backupText} onChange={(event) => setBackupText(event.target.value)} rows={5} placeholder="Cole aqui o texto do backup" />
            </label>
            <label className="stores-field stores-field-full">
              Senha mestra do backup
              <input type="password" autoComplete="current-password" value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} />
            </label>
            <div className="stores-form-actions stores-field-full">
              <button type="button" className="secondary" onClick={() => { setShowRestore(false); setFeedback(""); }}>Voltar</button>
              <button type="button" className="primary" disabled={busy || !backupText.trim() || !backupPassword} onClick={() => void importBackup()}>
                <UnlockKeyhole size={15} /> {busy ? "Restaurando…" : "Restaurar backup"}
              </button>
            </div>
          </div>
        ) : (
          <div className="stores-gate-form">
            <label className="stores-field stores-field-full">
              Senha mestra
              <input type="password" autoComplete={hasVault ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && hasVault) void unlock(); }} />
            </label>
            {!hasVault && (
              <label className="stores-field stores-field-full">
                Confirmar senha mestra
                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createVault(); }} />
              </label>
            )}
            <div className="stores-form-actions stores-field-full">
              <button type="button" className="primary" disabled={busy || !password || (!hasVault && !confirmPassword)} onClick={() => void (hasVault ? unlock() : createVault())}>
                {hasVault ? <UnlockKeyhole size={15} /> : <ShieldCheck size={15} />}
                {busy ? "Aguarde…" : hasVault ? "Desbloquear" : "Criar cofre"}
              </button>
              {hasVault && <button type="button" className="secondary" onClick={() => { setShowRestore(true); setFeedback(""); }}>Restaurar de um backup</button>}
            </div>
          </div>
        )}
        {feedback && <p className="stores-feedback" role="alert">{feedback}</p>}
        <div className="stores-security-note"><KeyRound size={15} /> Os dados são criptografados com AES-GCM no navegador antes de serem enviados ao banco compartilhado. Todos os membros precisam usar a mesma senha mestra.</div>
      </section>
    );
  }

  return (
    <section className="stores-view">
      <div className="stores-toolbar panel">
        <div className="stores-toolbar-copy">
          <div className="stores-toolbar-icon"><Store size={18} /></div>
          <div><strong>Cadastros protegidos</strong><span>{stores.length} {stores.length === 1 ? "loja cadastrada" : "lojas cadastradas"} neste navegador</span></div>
        </div>
        <div className="stores-toolbar-actions">
          <button type="button" className="secondary stores-action" onClick={openBackup}><Copy size={14} /> Backup</button>
          <button type="button" className="secondary stores-action" onClick={lockVault}><LockKeyhole size={14} /> Bloquear</button>
          <button type="button" className="primary stores-action" onClick={() => { setFeedback(""); setFormStore(newStore()); }}><Plus size={15} /> Nova loja</button>
        </div>
      </div>

      <div className="stores-workspace">
        <section className="panel stores-list-panel">
          <div className="stores-list-heading"><div><h2>Lojas</h2><p>Pesquise por nome, CNPJ ou e-mail.</p></div><span className="stores-count">{filteredStores.length}</span></div>
          <label className="stores-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar loja, CNPJ ou e-mail…" /></label>
          <div className="stores-list">
            {filteredStores.length ? filteredStores.map((store) => (
              <button type="button" key={store.id} className={`stores-list-item${selectedId === store.id ? " selected" : ""}`} onClick={() => setSelectedId(store.id)}>
                <span className="stores-list-avatar"><Building2 size={16} /></span>
                <span className="stores-list-main"><strong>{store.name}</strong><small>{store.cnpj || "CNPJ não informado"}</small></span>
                <span className="stores-account-count">{store.accounts.length}</span>
              </button>
            )) : <div className="stores-empty-list">{stores.length ? "Nenhuma loja encontrada para essa busca." : <><Store size={22} /><strong>Nenhuma loja ainda.</strong><span>Cadastre uma loja para guardar os dados de acesso.</span></>}</div>}
          </div>
        </section>

        <section className="panel stores-detail-panel">
          {selected ? (
            <>
              <div className="stores-detail-head"><div><span className="stores-detail-kicker">CADASTRO DA LOJA</span><h2>{selected.name}</h2><p>{selected.cnpj || "CNPJ não informado"}</p></div><div className="stores-detail-actions"><button type="button" className="secondary stores-icon-action" aria-label="Editar cadastro" title="Editar cadastro" onClick={() => { setFeedback(""); setFormStore({ ...selected, accounts: selected.accounts.map((account) => ({ ...account })) }); }}><Pencil size={15} /></button><button type="button" className="danger stores-icon-action" aria-label="Excluir cadastro" title="Excluir cadastro" disabled={busy} onClick={() => void deleteStore(selected)}><Trash2 size={15} /></button></div></div>
              <div className="stores-info-grid">
                <div className="stores-info-card"><Phone size={15} /><span><small>Telefone de contato</small><strong>{selected.phone || "Não informado"}</strong></span></div>
                <div className="stores-info-card"><UserRound size={15} /><span><small>Responsável</small><strong>{selected.responsible || "Não informado"}</strong></span></div>
              </div>
              <div className="stores-section-heading"><div><h3>Contas de acesso</h3><span>{selected.accounts.length} {selected.accounts.length === 1 ? "conta" : "contas"}</span></div></div>
              <div className="stores-accounts">
                {selected.accounts.map((account) => {
                  const isRevealed = revealed.includes(account.id);
                  return <article className="stores-account-card" key={account.id}>
                    <div className="stores-account-top"><span className="stores-role-badge">{account.role}</span>{account.email && <span className="stores-account-email"><Mail size={13} />{account.email}</span>}</div>
                    {account.password && <div className="stores-password-row"><span><small>Senha</small><strong>{isRevealed ? account.password : "••••••••••••"}</strong></span><button type="button" className="stores-reveal" aria-label={isRevealed ? "Ocultar senha" : "Mostrar senha"} onClick={() => setRevealed((items) => isRevealed ? items.filter((id) => id !== account.id) : [...items, account.id])}>{isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>}
                    {!account.email && !account.password && <p className="stores-account-empty">Nenhuma credencial informada.</p>}
                  </article>;
                })}
              </div>
              {selected.observations && <div className="stores-observations"><h3>Observações</h3><p>{selected.observations}</p></div>}
            </>
          ) : <div className="stores-empty-detail"><Store size={25} /><strong>{stores.length ? "Selecione uma loja" : "Seu cofre está pronto"}</strong><span>{stores.length ? "Escolha um cadastro na lista para ver os detalhes." : "Use “Nova loja” para começar a organizar os cadastros."}</span></div>}
        </section>
      </div>

      {feedback && <p className="stores-feedback stores-feedback-inline" role="status">{feedback}</p>}

      {formStore && (
        <div className="stores-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormStore(null); }}>
          <section className="stores-modal" role="dialog" aria-modal="true" aria-labelledby="store-form-title">
            <div className="stores-modal-head"><div><span className="stores-detail-kicker">CADASTROS/LOJAS</span><h2 id="store-form-title">{stores.some((store) => store.id === formStore.id) ? "Editar loja" : "Nova loja"}</h2></div><button type="button" className="stores-close" aria-label="Fechar" onClick={() => setFormStore(null)}><X size={18} /></button></div>
            <div className="stores-form-grid">
              <label className="stores-field">Nome da loja<input autoFocus value={formStore.name} onChange={(event) => setFormStore({ ...formStore, name: event.target.value })} placeholder="Ex.: Loja Centro" /></label>
              <label className="stores-field">CNPJ<input value={formStore.cnpj} onChange={(event) => setFormStore({ ...formStore, cnpj: event.target.value })} placeholder="00.000.000/0000-00" /></label>
              <label className="stores-field">Telefone de contato<input value={formStore.phone} onChange={(event) => setFormStore({ ...formStore, phone: event.target.value })} placeholder="(11) 90000-0000" /></label>
              <label className="stores-field">Responsável<input value={formStore.responsible} onChange={(event) => setFormStore({ ...formStore, responsible: event.target.value })} /></label>
              <div className="stores-field stores-field-full">
                <div className="stores-section-heading"><div><h3>Contas (e-mail e senha)</h3><span>Você pode cadastrar mais de uma conta para cada loja.</span></div><button type="button" className="stores-add-account" onClick={() => setFormStore({ ...formStore, accounts: [...formStore.accounts, newAccount()] })}><Plus size={14} /> Adicionar conta</button></div>
                <div className="stores-account-fields">
                  {formStore.accounts.map((account) => <div className="stores-account-field-row" key={account.id}>
                    <label className="stores-field">Perfil<select value={account.role} onChange={(event) => updateAccount(account.id, { role: event.target.value as Role })}>{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
                    <label className="stores-field">E-mail<input type="email" autoComplete="off" value={account.email} onChange={(event) => updateAccount(account.id, { email: event.target.value })} placeholder="e-mail" /></label>
                    <label className="stores-field">Senha<input type="password" autoComplete="new-password" value={account.password} onChange={(event) => updateAccount(account.id, { password: event.target.value })} placeholder="senha" /></label>
                    <button type="button" className="stores-remove-account" aria-label="Remover conta" title="Remover conta" disabled={formStore.accounts.length <= 1} onClick={() => setFormStore({ ...formStore, accounts: formStore.accounts.filter((item) => item.id !== account.id) })}><X size={15} /></button>
                  </div>)}
                </div>
              </div>
              <label className="stores-field stores-field-full">Observações<textarea rows={4} value={formStore.observations} onChange={(event) => setFormStore({ ...formStore, observations: event.target.value })} /></label>
            </div>
            {feedback && <p className="stores-feedback" role="alert">{feedback}</p>}
            <div className="stores-form-actions"><button type="button" className="secondary" onClick={() => setFormStore(null)}>Cancelar</button><button type="button" className="primary" disabled={busy} onClick={() => void saveStore()}>{busy ? "Salvando…" : "Salvar loja"}</button></div>
          </section>
        </div>
      )}

      {backupOpen && (
        <div className="stores-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBackupOpen(false); }}>
          <section className="stores-modal stores-backup-modal" role="dialog" aria-modal="true" aria-labelledby="stores-backup-title">
            <div className="stores-modal-head"><div><span className="stores-detail-kicker">SEGURANÇA DOS DADOS</span><h2 id="stores-backup-title">Backup do cofre</h2></div><button type="button" className="stores-close" aria-label="Fechar" onClick={() => setBackupOpen(false)}><X size={18} /></button></div>
            <p className="stores-gate-copy">O texto abaixo contém o cofre criptografado. Guarde-o em um local seguro. Para restaurar, será necessária a senha mestra usada neste backup.</p>
            <label className="stores-field stores-field-full">Backup criptografado<textarea rows={6} value={backupText} onChange={(event) => setBackupText(event.target.value)} /></label>
            <label className="stores-field stores-field-full">Senha mestra do backup<input type="password" autoComplete="current-password" value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} /></label>
            {feedback && <p className="stores-feedback" role="alert">{feedback}</p>}
            <div className="stores-form-actions stores-backup-actions"><button type="button" className="secondary" onClick={() => void copyBackup()} disabled={!backupText}>Copiar backup</button><button type="button" className="primary" onClick={() => void importBackup()} disabled={busy || !backupText.trim() || !backupPassword}>{busy ? "Importando…" : "Importar backup"}</button></div>
          </section>
        </div>
      )}
    </section>
  );
}
