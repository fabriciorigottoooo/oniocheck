import { NotebookPen, PenLine, Trash2 } from "lucide-react";
import { STEPS } from "@/lib/steps";
import type { ClientT, StepState } from "@/lib/types";
import { fullDate, timeShort } from "@/lib/format";
import { clientNotesPreview } from "@/lib/clientNotes";

type Props = {
  client: ClientT | null;
  onToggle: (index: number, value: boolean) => void;
  onRename: () => void;
  onNotes: () => void;
  onFinish: () => void;
  onReopen: () => void;
  onDelete: () => void;
};

export default function ClientDetail({
  client,
  onToggle,
  onRename,
  onNotes,
  onFinish,
  onReopen,
  onDelete,
}: Props) {
  if (!client) {
    return (
      <section className="panel" aria-label="Checklist do cliente">
        <div className="empty" style={{ padding: "72px 24px" }}>
          Selecione um cliente para ver o checklist.
        </div>
      </section>
    );
  }

  const c = client;
  const n = c.checks.filter((s) => s?.done).length;
  const done = !!c.finishedAt;

  return (
    <section className="panel" aria-label="Checklist do cliente">
      <div className="detail-head">
        <span className={`badge${done ? " done" : ""}`}>
          {done ? "FINALIZADO" : n === 10 ? "PRONTO PARA FINALIZAR" : "EM ANDAMENTO"}
        </span>
        <h2>{c.name}</h2>
        {(c.economicGroup || c.attendanceUnit || c.phone) && (
          <div className="client-identity">
            {c.economicGroup && <span>Grupo econômico: {c.economicGroup}</span>}
            {c.attendanceUnit && <span>Unidade de atendimento: {c.attendanceUnit}</span>}
            {c.phone && <span>Telefone: {c.phone}</span>}
          </div>
        )}
        <div className="detail-actions">
          <button className="rename-btn" onClick={onRename}>
            <PenLine size={12} /> Editar cliente
          </button>
          <button className="rename-btn" onClick={onNotes}>
            <NotebookPen size={12} /> Observações
          </button>
        </div>
        <div className="progress-label">
          <span>
            {done
              ? "Concluído em " + (c.finishedAt ? fullDate(c.finishedAt) : "")
              : `${n} de 10 etapas concluídas`}
          </span>
          <strong>{n * 10}%</strong>
        </div>
        <div
          className="bar big"
          role="progressbar"
          aria-label="Progresso do cliente"
          aria-valuenow={n}
          aria-valuemin={0}
          aria-valuemax={10}
        >
          <i style={{ width: `${n * 10}%` }} />
        </div>
      </div>

      <div className="notes-panel">
        <div className="notes-header">
          <strong>Observações</strong>
          <button type="button" className="mini-action" onClick={onNotes}>
            {c.notes ? "Editar" : "Adicionar"}
          </button>
        </div>
        {c.notes && c.notes.trim() ? (
          <p>{clientNotesPreview(c.notes, 260)}</p>
        ) : (
          <p className="notes-empty">Nenhuma observação registrada para este cliente.</p>
        )}
      </div>

      <div className="tasks">
        {STEPS.map((s, i) => {
          const st: StepState = c.checks[i] ?? { done: false, by: null, at: null };
          return (
            <label key={s} className="task">
              <input
                type="checkbox"
                checked={!!st.done}
                disabled={done}
                onChange={(e) => onToggle(i, e.target.checked)}
              />
              <span className="task-body">
                <span className="step">ETAPA {String(i + 1).padStart(2, "0")}</span>
                <span className="task-name">{s}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="detail-foot">
        <p>
          {done
            ? "Checklist preservado para consulta."
            : n === 10
              ? "Todas as etapas concluídas. Confirme a finalização."
              : "Marque as etapas conforme forem concluídas."}
        </p>
        {done ? (
          <>
            <button className="secondary" onClick={onReopen}>
              Reabrir checklist
            </button>
            <button className="danger" onClick={onDelete}>
              <Trash2 size={12} /> Excluir cliente
            </button>
          </>
        ) : (
          <button className="primary" onClick={onFinish} disabled={n < 10}>
            Finalizar cliente
          </button>
        )}
      </div>
    </section>
  );
}
