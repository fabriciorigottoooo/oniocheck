import type { Activity, ClientT, Collab } from "./types";

export const ONLINE_WINDOW_MS = 40_000;

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const stepTotal = (c: ClientT) =>
  c.checks.reduce((n, s) => n + (s.done ? 1 : 0), 0);

export const isOnline = (c: Collab, now: number) =>
  now - Date.parse(c.lastSeenAt) < ONLINE_WINDOW_MS;

export function timeShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function fullDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function relTime(iso: string, now: number): string {
  const diff = now - Date.parse(iso);
  if (!Number.isFinite(diff)) return "";
  if (diff < 45_000) return "agora";
  const m = Math.round(diff / 60_000);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

export function activityParts(a: Activity): { actor: string; msg: string } {
  const alvo = `“${a.clientName}”`;
  switch (a.action) {
    case "created":
      return { actor: a.actorName, msg: `adicionou o cliente ${alvo}` };
    case "renamed":
      return {
        actor: a.actorName,
        msg: `renomeou “${a.detail ?? "?"}” para ${alvo}`,
      };
    case "step_on":
      return { actor: a.actorName, msg: `marcou “${a.detail ?? ""}” em ${alvo}` };
    case "step_off":
      return {
        actor: a.actorName,
        msg: `desmarcou “${a.detail ?? ""}” em ${alvo}`,
      };
    case "finished":
      return { actor: a.actorName, msg: `finalizou ${alvo}` };
    case "reopened":
      return { actor: a.actorName, msg: `reabriu o checklist de ${alvo}` };
    case "imported":
      return {
        actor: a.actorName,
        msg: `restaurou um backup com ${a.detail ?? "?"} clientes`,
      };
    default:
      return { actor: a.actorName, msg: `atualizou ${alvo}` };
  }
}

export function genId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return (
      "id-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }
}
