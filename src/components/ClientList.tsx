import { Search } from "lucide-react";
import type { ClientT } from "@/lib/types";
import { fullDate, stepTotal } from "@/lib/format";

type Props = {
  title: string;
  search: string;
  onSearch: (v: string) => void;
  clients: ClientT[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyText: string;
};

export default function ClientList({
  title,
  search,
  onSearch,
  clients,
  selectedId,
  onSelect,
  emptyText,
}: Props) {
  return (
    <section className="panel">
      <div className="list-head">
        <h2>{title}</h2>
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
            const n = stepTotal(c);
            return (
              <button
                key={c.id}
                className={`client${c.id === selectedId ? " selected" : ""}`}
                aria-pressed={c.id === selectedId}
                onClick={() => onSelect(c.id)}
              >
                <span className="client-top">
                  <strong>{c.name}</strong>
                  <span className="pct">{n * 10}%</span>
                </span>
                <small className="client-meta">
                  {(c.economicGroup || c.attendanceUnit) && (
                    <span>
                      {c.economicGroup || "Grupo não informado"}
                      {c.economicGroup && c.attendanceUnit ? " · " : ""}
                      {c.attendanceUnit || ""}
                    </span>
                  )}
                  <span>
                    {c.finishedAt
                      ? "Finalizado em " + fullDate(c.finishedAt)
                      : `${n} de 10 etapas concluídas`}
                  </span>
                </small>
                <span className="bar">
                  <i style={{ width: `${n * 10}%` }} />
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
