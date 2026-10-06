import { randomUUID } from "crypto";
import { db, ensureDatabaseCompatibility } from "@/db";
import { clients } from "@/db/schema";
import { publish } from "@/lib/bus";
import { logActivity, resolveActor } from "@/lib/collab";
import type { StepState } from "@/lib/types";
import { isWorkflowComplete, normalizeWorkflow, type ImplementationWorkflow } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ImportRow = {
  id: string;
  name: string;
  economicGroup: string | null;
  attendanceUnit: string | null;
  attendanceUnits: string[];
  phone: string | null;
  notes: string | null;
  checks: StepState[];
  workflow: ImplementationWorkflow;
  finishedAt: Date | null;
};

function normalize(list: unknown): ImportRow[] | null {
  if (!Array.isArray(list) || list.length > 5000) return null;
  const seen = new Set<string>();
  const out: ImportRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return null;
    const it = item as Record<string, unknown>;
    const name = typeof it.name === "string" ? it.name.trim() : "";
    if (!name || name.length > 100) return null;

    const raw = it.checks;
    let checks: StepState[];
    if (
      Array.isArray(raw) &&
      raw.length === 10 &&
      raw.every((x) => typeof x === "boolean")
    ) {
      // backup v1 (booleans)
      checks = raw.map((b) => ({ done: b as boolean, by: null, at: null }));
    } else if (
      Array.isArray(raw) &&
      raw.length === 10 &&
      raw.every(
        (x) => x && typeof x === "object" && typeof (x as StepState).done === "boolean",
      )
    ) {
      // backup v2 (rich steps)
      checks = raw.map((x) => {
        const s = x as StepState;
        return {
          done: !!s.done,
          by: typeof s.by === "string" && s.done ? s.by.slice(0, 40) : null,
          at:
            s.done && s.at && Number.isFinite(Date.parse(s.at))
              ? new Date(s.at).toISOString()
              : null,
        };
      });
    } else {
      return null;
    }

    let finishedAt: Date | null = null;
    if (it.finishedAt !== null && it.finishedAt !== undefined) {
      if (
        typeof it.finishedAt !== "string" ||
        !Number.isFinite(Date.parse(it.finishedAt))
      ) {
        return null;
      }
      finishedAt = new Date(it.finishedAt);
    }

    const workflow = normalizeWorkflow(it.workflow, checks, finishedAt?.toISOString() ?? null);
    if (finishedAt && !isWorkflowComplete(workflow)) return null;

    const textField = (key: string, limit: number) =>
      typeof it[key] === "string" ? (it[key] as string).trim().slice(0, limit) || null : null;
    const attendanceUnits = Array.isArray(it.attendanceUnits)
      ? it.attendanceUnits.filter((unit): unit is string => typeof unit === "string").map((unit) => unit.trim().slice(0, 80)).filter(Boolean).slice(0, 20)
      : textField("attendanceUnit", 80) ? [textField("attendanceUnit", 80)!] : [];
    const attendanceUnit = attendanceUnits[0] ?? null;

    let id =
      typeof it.id === "string" && it.id.trim() ? it.id.trim().slice(0, 120) : randomUUID();
    if (seen.has(id)) id = randomUUID();
    seen.add(id);
    out.push({
      id,
      name,
      economicGroup: textField("economicGroup", 80),
      attendanceUnit,
      attendanceUnits,
      phone: textField("phone", 32),
      notes: textField("notes", 20_000),
      checks,
      workflow,
      finishedAt,
    });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    await ensureDatabaseCompatibility();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Corpo inválido." }, { status: 400 });
    }
    const raw = body as { payload?: unknown; actor?: unknown };
    const actor = await resolveActor(
      (raw?.actor as { id?: unknown; name?: unknown }) ?? {},
    );
    if (!actor) {
      return Response.json(
        { error: "Identifique-se para restaurar um backup." },
        { status: 400 },
      );
    }
    const payload = raw?.payload as { clients?: unknown } | undefined;
    const rows = normalize(payload?.clients);
    if (!rows) {
      return Response.json(
        { error: "Arquivo de backup inválido." },
        { status: 400 },
      );
    }
    await db.transaction(async (tx) => {
      await tx.delete(clients);
      const chunk = 500;
      for (let i = 0; i < rows.length; i += chunk) {
        await tx.insert(clients).values(rows.slice(i, i + chunk));
      }
    });
    const activity = await logActivity({
      actor,
      clientId: null,
      clientName: "backup",
      action: "imported",
      detail: String(rows.length),
    });
    publish({ type: "change", activity });
    return Response.json({ ok: true, count: rows.length });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
