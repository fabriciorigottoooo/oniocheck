import type { StepState } from "./types";

export type FacebookStatus = "already-uses" | "used-before" | "never-used";
export type WorkflowStatus = "todo" | "in_progress" | "done";
export type WorkflowTaskState = {
  status: WorkflowStatus;
  by: string | null;
  at: string | null;
};
export type ImplementationWorkflow = {
  version: 1;
  facebookStatus: FacebookStatus | null;
  needsFacebookAccess: boolean | null;
  createWebsite: boolean | null;
  tasks: Record<string, WorkflowTaskState>;
};
export type WorkflowUpdate =
  | { type: "task"; taskId: string; status: "todo" | "in_progress" | "done" }
  | { type: "facebook-path"; facebookStatus: FacebookStatus }
  | { type: "never-used-options"; needsFacebookAccess?: boolean; createWebsite?: boolean };

export type WorkflowTask = {
  id: string;
  title: string;
  description: string;
  group: string;
};

export const WORKFLOW_FILTERS = [
  { id: "onboarding", label: "Onboarding" },
  { id: "initial", label: "Checklist inicial" },
  { id: "api", label: "API oficial" },
  { id: "facebook", label: "Facebook e BM" },
  { id: "agenda", label: "Agenda e formulários" },
  { id: "license", label: "Licença e usuários" },
  { id: "training", label: "Treinamento" },
  { id: "linking", label: "Vinculação" },
] as const;

export const emptyWorkflow = (): ImplementationWorkflow => ({
  version: 1,
  facebookStatus: null,
  needsFacebookAccess: null,
  createWebsite: null,
  tasks: {},
});

const BASE_STAGES: WorkflowTask[] = [
  { id: "onboarding", title: "Onboarding", description: "Alinhar objetivo, responsáveis e contexto da implantação.", group: "onboarding" },
  { id: "initial", title: "Checklist inicial", description: "Reunir dados da empresa e confirmar os pré-requisitos.", group: "initial" },
  { id: "api", title: "Configurar API Oficial", description: "Validar o canal oficial e os dados necessários para iniciar a configuração.", group: "api" },
];

const FACEBOOK_DECISION: WorkflowTask = {
  id: "facebook-path",
  title: "Definir o cenário do Facebook",
  description: "Escolha o caminho que corresponde à experiência da empresa com o Facebook.",
  group: "facebook",
};

const COMMON_END: WorkflowTask[] = [
  { id: "license-data", title: "Validar pagamento e dados", description: "Conferir o pagamento e reunir os dados da licença e dos usuários.", group: "license" },
  { id: "create-license", title: "Criar licença e cadastrar usuários", description: "Provisionar a licença e configurar os acessos da equipe.", group: "license" },
  { id: "training", title: "Treinamento", description: "Preparar a equipe para operar o OnioChat.", group: "training" },
  { id: "linking", title: "Vinculação", description: "Conectar o número e validar o funcionamento com a empresa.", group: "linking" },
];

const branchStages = (workflow: ImplementationWorkflow): WorkflowTask[] => {
  switch (workflow.facebookStatus) {
    case "already-uses":
      return [
        { id: "confirm-bm", title: "Confirmar Business Manager", description: "Verificar o BM atual, os dados da empresa e eventuais restrições.", group: "facebook" },
      ];
    case "used-before":
      return [
        { id: "verify-facebook", title: "Verificar acesso ao Facebook", description: "Confirmar se é possível reutilizar o mesmo perfil do Facebook.", group: "facebook" },
        { id: "confirm-bm", title: "Confirmar Business Manager", description: "Verificar o BM atual, os dados da empresa e eventuais restrições.", group: "facebook" },
      ];
    case "never-used": {
      const scheduleNeeded = workflow.needsFacebookAccess === true || workflow.createWebsite === true;
      return [
        ...(workflow.createWebsite === true ? [
          { id: "website-form", title: "Preencher formulário do site", description: "Reunir as informações necessárias para solicitar a criação do site.", group: "agenda" },
        ] : []),
        ...(scheduleNeeded ? [
          { id: "schedule", title: "Agendar apoio", description: "Marcar a reunião necessária para acesso ao Facebook e/ou criação do site.", group: "agenda" },
        ] : []),
        { id: "fill-bm", title: "Preencher dados do Business Manager", description: "Preencher os dados da empresa e preparar o Business Manager para a implantação.", group: "facebook" },
      ];
    }
    default:
      return [];
  }
};

export function getWorkflowStages(workflow: ImplementationWorkflow): WorkflowTask[] {
  const beforeDecision = [...BASE_STAGES, FACEBOOK_DECISION];
  if (!workflow.facebookStatus) return [...beforeDecision, ...COMMON_END];
  return [...beforeDecision, ...branchStages(workflow), ...COMMON_END];
}

export function getWorkflowTaskState(workflow: ImplementationWorkflow, id: string): WorkflowTaskState {
  return workflow.tasks[id] ?? { status: "todo", by: null, at: null };
}

export function isFacebookDecisionComplete(workflow: ImplementationWorkflow) {
  if (!workflow.facebookStatus) return false;
  return workflow.facebookStatus !== "never-used" ||
    (workflow.needsFacebookAccess !== null && workflow.createWebsite !== null);
}

export function getWorkflowProgress(workflow: ImplementationWorkflow) {
  const stages = getWorkflowStages(workflow);
  const done = stages.filter((stage) => stage.id === "facebook-path"
    ? isFacebookDecisionComplete(workflow)
    : getWorkflowTaskState(workflow, stage.id).status === "done").length;
  return { done, total: stages.length, percent: stages.length ? Math.round((done / stages.length) * 100) : 0 };
}

export function isWorkflowComplete(workflow: ImplementationWorkflow) {
  const stages = getWorkflowStages(workflow);
  return stages.length > 0 && stages.every((stage) => stage.id === "facebook-path"
    ? isFacebookDecisionComplete(workflow)
    : getWorkflowTaskState(workflow, stage.id).status === "done");
}

export function isWorkflowFilterPending(workflow: ImplementationWorkflow, filterId: string) {
  if (filterId === "agenda") {
    if (!workflow.facebookStatus) return true;
    if (workflow.facebookStatus !== "never-used") return false;
    if (workflow.needsFacebookAccess === null || workflow.createWebsite === null) return true;
  }
  const stages = getWorkflowStages(workflow).filter((stage) => stage.group === filterId);
  if (!stages.length) return filterId === "facebook" && !isFacebookDecisionComplete(workflow);
  return stages.some((stage) => stage.id === "facebook-path"
    ? !isFacebookDecisionComplete(workflow)
    : getWorkflowTaskState(workflow, stage.id).status !== "done");
}

export function migrateWorkflow(checks: StepState[], finishedAt: string | null): ImplementationWorkflow {
  const workflow = emptyWorkflow();
  if (finishedAt) {
    workflow.facebookStatus = "already-uses";
    for (const stage of [...BASE_STAGES, ...branchStages(workflow), ...COMMON_END]) {
      workflow.tasks[stage.id] = { status: "done", by: null, at: finishedAt };
    }
    return workflow;
  }

  const old = (index: number) => checks[index]?.done === true;
  const hasProgress = checks.some((check) => check?.done);
  if (!hasProgress) return workflow;

  workflow.facebookStatus = "already-uses";
  const mark = (id: string, done: boolean) => {
    if (done) workflow.tasks[id] = { status: "done", by: null, at: null };
  };
  mark("onboarding", old(0));
  mark("initial", old(1));
  mark("api", checks.slice(2).some((check) => check?.done));
  mark("confirm-bm", old(6));
  mark("license-data", old(2) && old(4));
  mark("create-license", old(3) && old(5));
  mark("training", old(9));
  mark("linking", old(8));
  const stages = getWorkflowStages(workflow);
  let lastHistoricalStage = -1;
  stages.forEach((stage, index) => {
    if (stage.id === "facebook-path" ? isFacebookDecisionComplete(workflow) : getWorkflowTaskState(workflow, stage.id).status === "done") {
      lastHistoricalStage = index;
    }
  });
  stages.slice(0, lastHistoricalStage + 1).forEach((stage) => {
    if (stage.id !== "facebook-path" && getWorkflowTaskState(workflow, stage.id).status !== "done") {
      workflow.tasks[stage.id] = { status: "done", by: null, at: null };
    }
  });
  const finalStage = stages[stages.length - 1];
  if (finalStage && getWorkflowTaskState(workflow, finalStage.id).status === "done") {
    workflow.tasks[finalStage.id] = { status: "in_progress", by: null, at: null };
  }
  return workflow;
}

export function normalizeWorkflow(value: unknown, checks: StepState[], finishedAt: string | null): ImplementationWorkflow {
  if (!value || typeof value !== "object") return migrateWorkflow(checks, finishedAt);
  const candidate = value as Partial<ImplementationWorkflow>;
  const validFacebookStatus = candidate.facebookStatus === "already-uses" || candidate.facebookStatus === "used-before" || candidate.facebookStatus === "never-used";
  const tasks = candidate.tasks && typeof candidate.tasks === "object" ? candidate.tasks : {};
  const safeTasks: Record<string, WorkflowTaskState> = {};
  for (const [id, state] of Object.entries(tasks)) {
    if (!state || typeof state !== "object") continue;
    const status = state.status;
    if (status !== "todo" && status !== "in_progress" && status !== "done") continue;
    safeTasks[id] = {
      status,
      by: typeof state.by === "string" ? state.by : null,
      at: typeof state.at === "string" ? state.at : null,
    };
  }
  return {
    version: 1,
    facebookStatus: validFacebookStatus ? candidate.facebookStatus! : null,
    needsFacebookAccess: typeof candidate.needsFacebookAccess === "boolean" ? candidate.needsFacebookAccess : null,
    createWebsite: typeof candidate.createWebsite === "boolean" ? candidate.createWebsite : null,
    tasks: safeTasks,
  };
}

export function updateWorkflow(workflow: ImplementationWorkflow, update: WorkflowUpdate, actorName: string, now: string): ImplementationWorkflow {
  const next: ImplementationWorkflow = { ...workflow, tasks: { ...workflow.tasks } };
  if (update.type === "facebook-path") {
    if (update.facebookStatus !== "already-uses" && update.facebookStatus !== "used-before" && update.facebookStatus !== "never-used") {
      throw new Error("Selecione um cenário válido para o Facebook.");
    }
    const stages = getWorkflowStages(workflow);
    const decisionIndex = stages.findIndex((stage) => stage.id === "facebook-path");
    if (stages.slice(decisionIndex + 1).some((stage) => getWorkflowTaskState(workflow, stage.id).status !== "todo")) {
      throw new Error("O caminho do Facebook não pode ser alterado depois que a implantação começou.");
    }
    next.facebookStatus = update.facebookStatus;
    if (update.facebookStatus !== "never-used") {
      next.needsFacebookAccess = null;
      next.createWebsite = null;
    }
    return next;
  }
  if (update.type === "never-used-options") {
    if (workflow.facebookStatus !== "never-used") throw new Error("Selecione o caminho “Nunca usou” primeiro.");
    if (typeof update.needsFacebookAccess !== "boolean" && typeof update.createWebsite !== "boolean") {
      throw new Error("Escolha se a empresa precisa de acesso ao Facebook ou criar um site.");
    }
    if (branchStages(workflow).some((stage) => getWorkflowTaskState(workflow, stage.id).status !== "todo")) {
      throw new Error("As necessidades não podem ser alteradas depois que esta etapa começou.");
    }
    if (typeof update.needsFacebookAccess === "boolean") next.needsFacebookAccess = update.needsFacebookAccess;
    if (typeof update.createWebsite === "boolean") next.createWebsite = update.createWebsite;
    return next;
  }

  const stages = getWorkflowStages(workflow);
  const stageIndex = stages.findIndex((stage) => stage.id === update.taskId);
  if (stageIndex < 0 || update.taskId === "facebook-path") throw new Error("Etapa inválida.");
  const stage = stages[stageIndex];
  if (update.status !== "todo" && update.status !== "in_progress" && update.status !== "done") {
    throw new Error("Status de etapa inválido.");
  }
  const state = getWorkflowTaskState(workflow, stage.id);
  const previousDone = stages.slice(0, stageIndex).every((prior) => prior.id === "facebook-path"
    ? isFacebookDecisionComplete(workflow)
    : getWorkflowTaskState(workflow, prior.id).status === "done");
  if (!previousDone) throw new Error("Conclua as etapas anteriores para liberar esta etapa.");
  if (state.status === "done" && update.status !== "done") throw new Error("Uma etapa concluída não pode ser reaberta por aqui.");
  const otherInProgress = stages.find((other) => other.id !== stage.id && getWorkflowTaskState(workflow, other.id).status === "in_progress");
  if (update.status === "in_progress" && otherInProgress) throw new Error(`Conclua “${otherInProgress.title}” antes de iniciar outra etapa.`);
  if (update.status === "done" && state.status !== "in_progress") throw new Error("Inicie a etapa antes de concluí-la.");
  next.tasks[stage.id] = {
    status: update.status,
    by: update.status === "todo" ? null : actorName,
    at: update.status === "todo" ? null : now,
  };
  return next;
}
