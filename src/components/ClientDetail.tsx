import { PenLine } from "lucide-react";
import { STEPS } from "@/lib/steps";
import type { ClientT, StepState } from "@/lib/types";
import { fullDate, timeShort } from "@/lib/format";

type Props = {
  client: ClientT | null;
  onToggle: (index: number, value: boolean) => void;
  onRename: () => void;
  onFinish: () => void;
  onReopen: () => void;
};

export default function ClientDetail({
  client,
  onToggle,
  onRename,
  onFinish,
  onReopen,
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
        {(c.economicGroup || c.attendanceUnit) && (
          <div className="client-identity">
            {c.economicGroup && <span>Grupo econômico: {c.economicGroup}</span>}
            {c.attendanceUnit && <span>Unidade de atendimento: {c.attendanceUnit}</span>}
          </div>
        )}
        <button className="rename-btn" onClick={onRename}>
          <PenLine size={12} /> Editar cliente
        </button>
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
                {st.done && st.by ? (
                  <span className="byline">
                    por {st.by}
                    {st.at ? " · " + timeShort(st.at) : ""}
                  </span>
                ) : null}
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
          <button className="secondary" onClick={onReopen}>
            Reabrir checklist
          </button>
        ) : (
          <button className="primary" onClick={onFinish} disabled={n < 10}>
            Finalizar cliente
          </button>
        )}
      </div>
    </section>
  );
}
