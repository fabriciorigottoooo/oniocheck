"use client";

import { useState } from "react";
import {
  ArrowDown,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  GraduationCap,
  Globe2,
  KeyRound,
  Link2,
  LockKeyhole,
  Play,
  RotateCcw,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ImplementationWorkflow, WorkflowTask, WorkflowUpdate } from "@/lib/workflow";
import {
  getWorkflowStages,
  getWorkflowTaskState,
  isFacebookDecisionComplete,
} from "@/lib/workflow";

const stageIcons: Record<string, LucideIcon> = {
  onboarding: Users,
  initial: FileText,
  api: Settings2,
  "facebook-path": CircleHelp,
  "verify-facebook": Globe2,
  "confirm-bm": Building2,
  "website-form": FileText,
  schedule: CalendarDays,
  "fill-bm": Building2,
  "license-data": BadgeCheck,
  "create-license": KeyRound,
  training: GraduationCap,
  linking: Link2,
};

const paths = [
  { id: "already-uses", label: "Já utiliza", description: "Vamos confirmar o BM atual." },
  { id: "used-before", label: "Já utilizou", description: "Vamos verificar se dá para reutilizar o Facebook." },
  { id: "never-used", label: "Nunca usou", description: "Vamos preparar acessos e dados do BM." },
] as const;

type Props = {
  workflow: ImplementationWorkflow;
  finished: boolean;
  busy: boolean;
  onUpdate: (update: WorkflowUpdate) => void;
};

function stageIsDone(stage: WorkflowTask, workflow: ImplementationWorkflow) {
  return stage.id === "facebook-path"
    ? isFacebookDecisionComplete(workflow)
    : getWorkflowTaskState(workflow, stage.id).status === "done";
}

export default function ImplementationBoard({ workflow, finished, busy, onUpdate }: Props) {
  const [editingPath, setEditingPath] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const stages = getWorkflowStages(workflow);
  const decisionIndex = stages.findIndex((stage) => stage.id === "facebook-path");
  const branchStages = stages.slice(decisionIndex + 1);
  const canEditPath = branchStages.every((stage) => getWorkflowTaskState(workflow, stage.id).status === "todo");
  const nextIndex = stages.findIndex((stage, index) => {
    if (stage.id === "facebook-path") return !isFacebookDecisionComplete(workflow) && stages.slice(0, index).every((prior) => stageIsDone(prior, workflow));
    return getWorkflowTaskState(workflow, stage.id).status !== "done" && stages.slice(0, index).every((prior) => stageIsDone(prior, workflow));
  });
  const activeTask = stages.find((stage) => getWorkflowTaskState(workflow, stage.id).status === "in_progress");
  const completedCount = stages.filter((stage) => stageIsDone(stage, workflow)).length;
  const progress = stages.length ? Math.round((completedCount / stages.length) * 100) : 0;
  const lanes = [
    { id: "todo", title: "Próximas etapas", subtitle: "Liberadas em sequência", icon: ArrowDown },
    { id: "doing", title: "Em andamento", subtitle: "O foco da equipe agora", icon: Clock3 },
    { id: "done", title: "Concluídas", subtitle: "Histórico desta implantação", icon: Check },
  ] as const;

  const laneFor = (stage: WorkflowTask, index: number) => {
    if (stageIsDone(stage, workflow)) return "done";
    if (stage.id === "facebook-path") {
      return stages.slice(0, index).every((prior) => stageIsDone(prior, workflow)) ? "doing" : "todo";
    }
    const status = getWorkflowTaskState(workflow, stage.id).status;
    if (status === "in_progress") return "doing";
    return "todo";
  };

  const renderDecision = (stage: WorkflowTask) => {
    const decisionComplete = isFacebookDecisionComplete(workflow);
    const showChoices = !decisionComplete || (editingPath && canEditPath);
    const selectedPath = paths.find((path) => path.id === workflow.facebookStatus);
    return (
      <div className="workflow-decision-content">
        {decisionComplete && !showChoices ? (
          <div className="workflow-selected-path">
            <span className="workflow-selected-check"><Check size={13} /></span>
            <div><strong>{selectedPath?.label}</strong><small>{selectedPath?.description}</small></div>
            {canEditPath && !finished && <button type="button" className="workflow-edit-path" onClick={() => setEditingPath(true)} disabled={busy}>Alterar</button>}
          </div>
        ) : (
          <>
            <div className="workflow-path-options">
              {paths.map((path) => (
                <button
                  type="button"
                  key={path.id}
                  className={`workflow-path-option${workflow.facebookStatus === path.id ? " selected" : ""}`}
                  disabled={busy || finished}
                  onClick={() => {
                    onUpdate({ type: "facebook-path", facebookStatus: path.id });
                    setEditingPath(false);
                  }}
                >
                  <span className="workflow-path-radio" />
                  <span><strong>{path.label}</strong><small>{path.description}</small></span>
                </button>
              ))}
            </div>
            {workflow.facebookStatus === "never-used" && (
              <div className="workflow-questions">
                <div className="workflow-question">
                  <strong>Precisa de acesso a algum Facebook?</strong>
                  <div>{([true, false] as const).map((value) => <button key={String(value)} type="button" className={workflow.needsFacebookAccess === value ? "selected" : ""} disabled={busy || finished || !canEditPath} onClick={() => onUpdate({ type: "never-used-options", needsFacebookAccess: value })}>{value ? "Sim" : "Não"}</button>)}</div>
                </div>
                <div className="workflow-question">
                  <strong>Precisa criar um site?</strong>
                  <div>{([true, false] as const).map((value) => <button key={String(value)} type="button" className={workflow.createWebsite === value ? "selected" : ""} disabled={busy || finished || !canEditPath} onClick={() => onUpdate({ type: "never-used-options", createWebsite: value })}>{value ? "Sim" : "Não"}</button>)}</div>
                </div>
                {!decisionComplete && <small className="workflow-decision-hint">Responda às duas perguntas para liberar as próximas etapas.</small>}
              </div>
            )}
          </>
        )}
        {stage.description && <p className="workflow-decision-note">{stage.description}</p>}
      </div>
    );
  };

  const renderStageCard = (stage: WorkflowTask, index: number) => {
    const Icon = stageIcons[stage.id] ?? LockKeyhole;
    const decision = stage.id === "facebook-path";
    const done = stageIsDone(stage, workflow);
    const taskState = decision ? null : getWorkflowTaskState(workflow, stage.id);
    const previousDone = stages.slice(0, index).every((prior) => stageIsDone(prior, workflow));
    const locked = !done && !previousDone && taskState?.status !== "in_progress";
    const ready = !done && previousDone && taskState?.status === "todo";
    const number = String(index + 1).padStart(2, "0");
    const isExpanded = expanded[stage.id] ?? ready;
    const note = noteDrafts[stage.id] ?? taskState?.note ?? "";
    return (
      <article className={`workflow-card${locked ? " is-locked" : ""}${ready ? " is-ready" : ""}${done ? " is-done" : ""}${decision ? " is-decision" : ""}`} key={stage.id}>
        <div className="workflow-card-top">
          <span className="workflow-step-number">{number}</span>
          <span className="workflow-stage-icon"><Icon size={17} /></span>
          <span className={`workflow-status-tag ${done ? "done" : locked ? "locked" : "open"}`}>
            {done ? "Concluída" : locked ? "Bloqueada" : decision ? "Decisão" : taskState?.status === "in_progress" ? "Em andamento" : "Disponível"}
          </span>
        </div>
        <h4>{stage.title}</h4>
        {!decision && <p>{stage.description}</p>}
        {!decision && <button type="button" className="workflow-expand-button" aria-expanded={isExpanded} onClick={() => setExpanded((current) => ({ ...current, [stage.id]: !isExpanded }))}><ChevronDown size={14} /> {isExpanded ? "Recolher detalhes" : "Ver detalhes e observações"}</button>}
        {!decision && isExpanded && <div className="workflow-stage-details">
          <div className="workflow-detail-block"><strong>Objetivo desta etapa</strong><p>{stage.description}</p></div>
          <div className="workflow-detail-block"><strong>Dependência</strong><p>{index === 0 ? "Etapa inicial da implantação." : `Liberada após concluir: ${stages[index - 1].title}.`}</p></div>
          <label className="workflow-observation"><span>Observações da equipe</span><textarea value={note} maxLength={2000} disabled={finished} placeholder="Registre contatos, pendências, decisões e o contexto desta etapa…" onChange={(event) => setNoteDrafts((current) => ({ ...current, [stage.id]: event.target.value }))} /><small>{note.length}/2000 caracteres · visível para a equipe</small></label>
          {!finished && note !== (taskState?.note ?? "") && <button type="button" className="workflow-save-note" disabled={busy} onClick={() => onUpdate({ type: "task-note", taskId: stage.id, note })}>Salvar observação</button>}
        </div>}
        {decision && renderDecision(stage)}
        {locked && <div className="workflow-lock-hint"><LockKeyhole size={13} /> Libera após concluir a etapa anterior</div>}
        {taskState?.status === "in_progress" && !finished && (
          <div className="workflow-card-actions">
            <button type="button" className="workflow-complete-button" disabled={busy} onClick={() => onUpdate({ type: "task", taskId: stage.id, status: "done" })}><Check size={14} /> Marcar concluída</button>
            <button type="button" className="workflow-pause-button" disabled={busy} onClick={() => onUpdate({ type: "task", taskId: stage.id, status: "todo" })}>Pausar</button>
          </div>
        )}
        {ready && !finished && <button type="button" className="workflow-start-button" disabled={busy} onClick={() => onUpdate({ type: "task", taskId: stage.id, status: "in_progress" })}><Play size={13} fill="currentColor" /> Iniciar etapa <ChevronRight size={14} /></button>}
      </article>
    );
  };

  return (
    <section className="implementation-board" aria-label="Quadro de implantação do OnioChat">
      {busy && <div className="workflow-sync-indicator" role="status" aria-live="polite"><i /> Salvando atualização para toda a equipe…</div>}
      <div className="workflow-overview">
        <div className="workflow-overview-top">
          <div><span className="workflow-kicker">IMPLANTAÇÃO ONIOCHAT</span><h3>Quadro de implantação</h3><p>O próximo passo é liberado quando a etapa anterior é concluída.</p></div>
          <div className="workflow-progress-count"><strong>{completedCount}<small>/{stages.length}</small></strong><span>etapas concluídas</span></div>
        </div>
        <div className="workflow-progress-track" role="progressbar" aria-label="Progresso da implantação" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></div>
        <div className="workflow-overview-foot"><span>{progress}% da implantação</span>{activeTask ? <span><Clock3 size={13} /> Em foco: {activeTask.title}</span> : nextIndex >= 0 ? <span><ChevronRight size={13} /> Próxima: {stages[nextIndex].title}</span> : <span><BadgeCheck size={13} /> Implantação concluída</span>}</div>
      </div>

      <div className="workflow-lanes">
        {lanes.map((lane) => {
          const Icon = lane.icon;
          const laneStages = stages.map((stage, index) => ({ stage, index })).filter(({ stage, index }) => laneFor(stage, index) === lane.id);
          return (
            <section className={`workflow-lane lane-${lane.id}`} key={lane.id} aria-label={lane.title}>
              <header className="workflow-lane-header"><span className="workflow-lane-icon"><Icon size={15} /></span><div><h4>{lane.title}</h4><p>{lane.subtitle}</p></div><span className="workflow-lane-count">{laneStages.length}</span></header>
              <div className="workflow-lane-cards">{laneStages.length ? laneStages.map(({ stage, index }) => renderStageCard(stage, index)) : <div className="workflow-lane-empty">{lane.id === "doing" ? "Conclua a etapa anterior para começar." : "As etapas concluídas aparecem aqui."}</div>}</div>
            </section>
          );
        })}
      </div>
      {finished && <div className="workflow-finished-banner"><BadgeCheck size={18} /><span><strong>Implantação concluída</strong><small>O OnioChat está pronto para operar.</small></span></div>}
    </section>
  );
}
