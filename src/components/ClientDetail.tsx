import { NotebookPen, PenLine, Trash2 } from "lucide-react";
import type { ClientT } from "@/lib/types";
import type { WorkflowUpdate } from "@/lib/workflow";
import { emptyWorkflow, getWorkflowProgress, migrateWorkflow } from "@/lib/workflow";
import { fullDate } from "@/lib/format";
import { clientNotesPreview } from "@/lib/clientNotes";
import ImplementationBoard from "./ImplementationBoard";

type Props = {
  client: ClientT | null;
  busy: boolean;
  onWorkflowUpdate: (client: ClientT, update: WorkflowUpdate) => void;
  onRename: () => void;
  onNotes: () => void;
  onReopen: () => void;
  onDelete: () => void;
};

export default function ClientDetail({
  client,
  busy,
  onWorkflowUpdate,
  onRename,
  onNotes,
  onReopen,
  onDelete,
}: Props) {
  if (!client) {
    return (
      <section className="panel" aria-label="Implantação do cliente">
        <div className="empty" style={{ padding: "72px 24px" }}>
          Selecione um cliente para acompanhar a implantação.
        </div>
      </section>
    );
  }

  const c = client;
  const attendanceUnits = c.attendanceUnits?.length
    ? c.attendanceUnits.join(", ")
    : c.attendanceUnit;
  const workflow = c.workflow ?? (c.finishedAt ? migrateWorkflow(c.checks, c.finishedAt) : emptyWorkflow());
  const workflowProgress = getWorkflowProgress(workflow);
  const done = !!c.finishedAt;

  return (
    <section className="panel" aria-label="Implantação do cliente">
      <div className="detail-head">
        <span className={`badge${done ? " done" : ""}`}>
          {done ? "IMPLANTAÇÃO CONCLUÍDA" : "IMPLANTAÇÃO EM ANDAMENTO"}
        </span>
        <h2>{c.name}</h2>
        {(c.economicGroup || attendanceUnits || c.phone) && (
          <div className="client-identity">
            {c.economicGroup && <span>Grupo econômico: {c.economicGroup}</span>}
            {attendanceUnits && <span>Unidades de atendimento: {attendanceUnits}</span>}
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
              ? "Concluída em " + (c.finishedAt ? fullDate(c.finishedAt) : "")
              : `${workflowProgress.done} de ${workflowProgress.total} etapas concluídas`}
          </span>
          <strong>{workflowProgress.percent}%</strong>
        </div>
        <div
          className="bar big"
          role="progressbar"
          aria-label="Progresso da implantação"
          aria-valuenow={workflowProgress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${workflowProgress.percent}%` }} />
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

      <ImplementationBoard
        workflow={workflow}
        finished={done}
        busy={busy}
        onUpdate={(update) => onWorkflowUpdate(c, update)}
      />

      <div className="detail-foot">
        <p>
          {done
            ? "Histórico da implantação preservado para consulta."
            : "As etapas bloqueadas serão liberadas conforme a implantação avançar."}
        </p>
        {done ? (
          <>
            <button className="secondary" onClick={onReopen}>
              Reabrir implantação
            </button>
            <button className="danger" onClick={onDelete}>
              <Trash2 size={12} /> Excluir cliente
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
