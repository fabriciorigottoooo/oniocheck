import { ChevronLeft, Search } from "lucide-react";
import type { ClientT } from "@/lib/types";
import { fullDate } from "@/lib/format";
import { getWorkflowProgress, normalizeWorkflow } from "@/lib/workflow";

type Props = {
  title: string;
  search: string;
  onSearch: (v: string) => void;
  clients: ClientT[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyText: string;
  onCollapse?: () => void;
};

export default function ClientList({
  title,
  search,
  onSearch,
  clients,
  selectedId,
  onSelect,
  emptyText,
  onCollapse,
}: Props) {
  return (
    <section className="panel">
      <div className="list-head">
        <h2>{title}</h2>
        {onCollapse && <button type="button" className="client-list-collapse" onClick={onCollapse} aria-label="Recolher lista de clientes" title="Recolher lista para ampliar o Kanban"><ChevronLeft size={15} /><span>Recolher</span></button>}
        <div className="search-wrap">
          <Search size={14} />
          <input
            className="search"
            type="search"
            placeholder="Buscar cliente..."
            aria-label="Buscar cliente"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="clients">
        {clients.length ? (
          clients.map((c) => {
            const progress = getWorkflowProgress(c.workflow ?? normalizeWorkflow(null, c.checks, c.finishedAt));
            return (
              <button
                key={c.id}
                className={`client${c.id === selectedId ? " selected" : ""}`}
                aria-pressed={c.id === selectedId}
                onClick={() => onSelect(c.id)}
              >
                <span className="client-top">
                  <strong>{c.name}</strong>
                  <span className="pct">{progress.percent}%</span>
                </span>
                <small className="client-meta">
                  {c.finishedAt
                    ? "Finalizado em " + fullDate(c.finishedAt)
                    : `${progress.done} de ${progress.total} etapas concluídas`}
                </small>
                <span className="bar">
                  <i style={{ width: `${progress.percent}%` }} />
                </span>
              </button>
            );
          })
        ) : (
          <div className="empty">{emptyText}</div>
        )}
      </div>
    </section>
  );
}
