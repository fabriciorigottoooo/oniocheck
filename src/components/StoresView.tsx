"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Building2,
  Copy,
  Eye,
  EyeOff,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Store,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ActorInput, StoreAccount, StoreRecord } from "@/lib/types";

const ROLES: StoreAccount["role"][] = ["Atendente", "Administrador", "Suporte"];

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

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function StoresView({ actor }: { actor: ActorInput }) {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [revision, setRevision] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formStore, setFormStore] = useState<StoreRecord | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupText, setBackupText] = useState("");
  const [revealed, setRevealed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await api.getStores();
      setStores(data.stores);
      setRevision(data.revision);
      setSelectedId((current) => data.stores.some((store) => store.id === current)
        ? current
        : data.stores[0]?.id ?? null);
      setFeedback("");
    } catch (error) {
      setFeedback(message(error, "Não foi possível carregar os cadastros das lojas."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = () => { void refresh(); };
    return () => events.close();
  }, [refresh]);

  const selected = stores.find((store) => store.id === selectedId) ?? null;
  const filteredStores = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    if (!q) return stores;
    return stores.filter((store) =>
      [store.name, store.cnpj, ...store.accounts.map((account) => account.email)]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(q)),
    );
  }, [query, stores]);

  const saveStores = async (next: StoreRecord[], selectedAfter: string | null) => {
    setBusy(true);
    setFeedback("");
    try {
      const result = await api.saveStores({ stores: next, expectedUpdatedAt: revision, actor });
      setStores(next);
      setRevision(result.revision);
      setSelectedId(selectedAfter);
      setFormStore(null);
      return true;
    } catch (error) {
      const errorText = message(error, "Não foi possível salvar os cadastros.");
      if (errorText.includes("Outro membro")) {
        await refresh();
        setFeedback(errorText);
      } else {
        setFeedback(errorText);
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveStore = async () => {
    if (!formStore) return;
    const name = formStore.name.trim();
    if (!name) {
      setFeedback("Informe o nome da loja.");
      return;
    }
    const cleaned: StoreRecord = {
      ...formStore,
      name,
      cnpj: formStore.cnpj.trim(),
      phone: formStore.phone.trim(),
      responsible: formStore.responsible.trim(),
      observations: formStore.observations.trim(),
      accounts: formStore.accounts.map((account) => ({ ...account, email: account.email.trim() })),
      updatedAt: new Date().toISOString(),
    };
    const exists = stores.some((store) => store.id === cleaned.id);
    const next = exists
      ? stores.map((store) => store.id === cleaned.id ? cleaned : store)
      : [cleaned, ...stores];
    await saveStores(next, cleaned.id);
  };

  const deleteStore = async (store: StoreRecord) => {
    if (!window.confirm(`Excluir o cadastro de “${store.name}”? Essa ação não pode ser desfeita.`)) return;
    const next = stores.filter((item) => item.id !== store.id);
    await saveStores(next, next[0]?.id ?? null);
  };

  const openBackup = () => {
    setBackupText(JSON.stringify(stores, null, 2));
    setFeedback("");
    setBackupOpen(true);
  };

  const copyBackup = async () => {
    try {
      await navigator.clipboard.writeText(backupText);
      setFeedback("Backup copiado.");
    } catch {
      setFeedback("Não foi possível copiar automaticamente. Selecione e copie o texto.");
    }
  };

  const importBackup = async () => {
    let incoming: StoreRecord[];
    try {
      const parsed: unknown = JSON.parse(backupText);
      if (!Array.isArray(parsed) || parsed.some((item) => !item || typeof item !== "object" || typeof item.name !== "string" || !Array.isArray(item.accounts))) {
        throw new Error("Formato de backup inválido.");
      }
      incoming = parsed as StoreRecord[];
    } catch (error) {
      setFeedback(message(error, "Backup inválido."));
      return;
    }
    if (stores.length && !window.confirm("Importar este backup vai substituir todos os cadastros compartilhados da equipe. Deseja continuar?")) return;
    const next = incoming.map((store) => ({ ...store, id: store.id || crypto.randomUUID() }));
    const saved = await saveStores(next, next[0]?.id ?? null);
    if (saved) setBackupOpen(false);
  };

  const updateAccount = (accountId: string, patch: Partial<StoreAccount>) => {
    setFormStore((current) => current ? {
      ...current,
      accounts: current.accounts.map((account) => account.id === accountId ? { ...account, ...patch } : account),
    } : current);
  };

  if (loading) return (
    <section className="panel stores-loading" aria-live="polite" aria-busy="true">
      <Image src="/logo_oniocheck_horizontal.png" alt="OnioCheck" width={1200} height={429} className="stores-loading-logo" />
      <p>Carregando os cadastros compartilhados…</p>
      <div className="loading-bar" role="progressbar" aria-label="Carregando cadastros">
        <i />
      </div>
    </section>
  );

  return (
    <section className="stores-view">
      <div className="stores-toolbar panel">
        <div className="stores-toolbar-copy">
          <div className="stores-toolbar-icon"><Store size={18} /></div>
          <div><strong>Cadastros compartilhados</strong><span>{stores.length} {stores.length === 1 ? "loja cadastrada" : "lojas cadastradas"} · toda a equipe pode visualizar e editar</span></div>
        </div>
        <div className="stores-toolbar-actions">
          <button type="button" className="secondary stores-action" onClick={openBackup}><Copy size={14} /> Backup</button>
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
          {selected ? <>
            <div className="stores-detail-head"><div><span className="stores-detail-kicker">CADASTRO DA LOJA</span><h2>{selected.name}</h2><p>{selected.cnpj || "CNPJ não informado"}</p></div><div className="stores-detail-actions"><button type="button" className="secondary stores-icon-action" aria-label="Editar cadastro" title="Editar cadastro" onClick={() => { setFeedback(""); setFormStore({ ...selected, accounts: selected.accounts.map((account) => ({ ...account })) }); }}><Pencil size={15} /></button><button type="button" className="danger stores-icon-action" aria-label="Excluir cadastro" title="Excluir cadastro" disabled={busy} onClick={() => void deleteStore(selected)}><Trash2 size={15} /></button></div></div>
            <div className="stores-info-grid"><div className="stores-info-card"><Phone size={15} /><span><small>Telefone de contato</small><strong>{selected.phone || "Não informado"}</strong></span></div><div className="stores-info-card"><UserRound size={15} /><span><small>Responsável</small><strong>{selected.responsible || "Não informado"}</strong></span></div></div>
            <div className="stores-section-heading"><div><h3>Contas de acesso</h3><span>{selected.accounts.length} {selected.accounts.length === 1 ? "conta" : "contas"}</span></div></div>
            <div className="stores-accounts">{selected.accounts.map((account) => {
              const isRevealed = revealed.includes(account.id);
              return <article className="stores-account-card" key={account.id}><div className="stores-account-top"><span className="stores-role-badge">{account.role}</span>{account.email && <span className="stores-account-email"><Mail size={13} />{account.email}</span>}</div>{account.password && <div className="stores-password-row"><span><small>Senha</small><strong>{isRevealed ? account.password : "••••••••••••"}</strong></span><button type="button" className="stores-reveal" aria-label={isRevealed ? "Ocultar senha" : "Mostrar senha"} onClick={() => setRevealed((items) => isRevealed ? items.filter((id) => id !== account.id) : [...items, account.id])}>{isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>}{!account.email && !account.password && <p className="stores-account-empty">Nenhuma credencial informada.</p>}</article>;
            })}</div>
            {selected.observations && <div className="stores-observations"><h3>Observações</h3><p>{selected.observations}</p></div>}
          </> : <div className="stores-empty-detail"><Store size={25} /><strong>{stores.length ? "Selecione uma loja" : "Nenhuma loja selecionada"}</strong><span>{stores.length ? "Escolha um cadastro na lista para ver os detalhes." : "Use “Nova loja” para começar a organizar os cadastros."}</span></div>}
        </section>
      </div>

      {feedback && <p className="stores-feedback stores-feedback-inline" role="status">{feedback}</p>}

      {formStore && <div className="stores-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormStore(null); }}><section className="stores-modal" role="dialog" aria-modal="true" aria-labelledby="store-form-title">
        <div className="stores-modal-head"><div><span className="stores-detail-kicker">CADASTROS/LOJAS</span><h2 id="store-form-title">{stores.some((store) => store.id === formStore.id) ? "Editar loja" : "Nova loja"}</h2></div><button type="button" className="stores-close" aria-label="Fechar" onClick={() => setFormStore(null)}><X size={18} /></button></div>
        <div className="stores-form-grid">
          <label className="stores-field">Nome da loja<input autoFocus value={formStore.name} onChange={(event) => setFormStore({ ...formStore, name: event.target.value })} placeholder="Ex.: Loja Centro" /></label>
          <label className="stores-field">CNPJ<input value={formStore.cnpj} onChange={(event) => setFormStore({ ...formStore, cnpj: event.target.value })} placeholder="00.000.000/0000-00" /></label>
          <label className="stores-field">Telefone de contato<input value={formStore.phone} onChange={(event) => setFormStore({ ...formStore, phone: event.target.value })} placeholder="(11) 90000-0000" /></label>
          <label className="stores-field">Responsável<input value={formStore.responsible} onChange={(event) => setFormStore({ ...formStore, responsible: event.target.value })} /></label>
          <div className="stores-field stores-field-full"><div className="stores-section-heading"><div><h3>Contas (e-mail e senha)</h3><span>Todos os membros da equipe podem consultar e editar estas credenciais.</span></div><button type="button" className="stores-add-account" onClick={() => setFormStore({ ...formStore, accounts: [...formStore.accounts, newAccount()] })}><Plus size={14} /> Adicionar conta</button></div><div className="stores-account-fields">{formStore.accounts.map((account) => <div className="stores-account-field-row" key={account.id}><label className="stores-field">Perfil<select value={account.role} onChange={(event) => updateAccount(account.id, { role: event.target.value as StoreAccount["role"] })}>{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></label><label className="stores-field">E-mail<input type="email" autoComplete="off" value={account.email} onChange={(event) => updateAccount(account.id, { email: event.target.value })} placeholder="e-mail" /></label><label className="stores-field">Senha<input type="text" autoComplete="off" value={account.password} onChange={(event) => updateAccount(account.id, { password: event.target.value })} placeholder="senha" /></label><button type="button" className="stores-remove-account" aria-label="Remover conta" title="Remover conta" disabled={formStore.accounts.length <= 1} onClick={() => setFormStore({ ...formStore, accounts: formStore.accounts.filter((item) => item.id !== account.id) })}><X size={15} /></button></div>)}</div></div>
          <label className="stores-field stores-field-full">Observações<textarea rows={4} value={formStore.observations} onChange={(event) => setFormStore({ ...formStore, observations: event.target.value })} /></label>
        </div>
        {feedback && <p className="stores-feedback" role="alert">{feedback}</p>}
        <div className="stores-form-actions"><button type="button" className="secondary" onClick={() => setFormStore(null)}>Cancelar</button><button type="button" className="primary" disabled={busy} onClick={() => void saveStore()}>{busy ? "Salvando…" : "Salvar loja"}</button></div>
      </section></div>}

      {backupOpen && <div className="stores-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBackupOpen(false); }}><section className="stores-modal stores-backup-modal" role="dialog" aria-modal="true" aria-labelledby="stores-backup-title"><div className="stores-modal-head"><div><span className="stores-detail-kicker">BACKUP COMPARTILHADO</span><h2 id="stores-backup-title">Exportar ou importar</h2></div><button type="button" className="stores-close" aria-label="Fechar" onClick={() => setBackupOpen(false)}><X size={18} /></button></div><p className="stores-gate-copy">Este backup contém os dados e as senhas das lojas em texto legível. Guarde o arquivo ou texto em local seguro.</p><label className="stores-field stores-field-full">Dados do backup<textarea rows={8} value={backupText} onChange={(event) => setBackupText(event.target.value)} /></label>{feedback && <p className="stores-feedback" role="alert">{feedback}</p>}<div className="stores-form-actions stores-backup-actions"><button type="button" className="secondary" onClick={() => void copyBackup()}>Copiar backup</button><button type="button" className="primary" disabled={busy} onClick={() => void importBackup()}>{busy ? "Importando…" : "Importar e substituir"}</button></div></section></div>}
    </section>
  );
}
