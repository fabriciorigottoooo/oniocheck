import type { StepState } from "./types";

export const STEPS = [
  "Onboard",
  "CheckList Inicial",
  "Dados da licença",
  "Criação da licença",
  "Dados Usuários",
  "Cadastro Usuários",
  "Conferência da BM",
  "Agendamento Vinculação",
  "Vinculação Número",
  "Treinamento",
] as const;

export const STEP_COUNT = STEPS.length;

export const SEED: ReadonlyArray<readonly [string, string]> = [
  ["Grupo Bona", "1111111100"],
  ["Rede do Povo", "1111111100"],
  ["Inova Abaeté", "1111000000"],
  ["Total Araçariguama", "1111000000"],
  ["Economize Jaciara", "1100000000"],
  ["São José Drogarias", "1111001000"],
  ["Farmácia do Pedrin", "1110000000"],
  ["MultiDrogas (Heito…", "1111101000"],
  ["AC Farma Mafra", "1111110000"],
  ["Ultra Brasnorte", "1111111000"],
  ["Vera cruz", "1000000000"],
  ["Alto Garças", "1000000000"],
  ["Riachao", "0000000000"],
  ["Mario Guerreiro", "1110100000"],
  ["Alexandro", "0000000000"],
];

export const emptyChecks = (): StepState[] =>
  STEPS.map(() => ({ done: false, by: null, at: null }));

export const checksFromBits = (bits: string): StepState[] =>
  [...bits].map((b) => ({ done: b === "1", by: null, at: null }));
