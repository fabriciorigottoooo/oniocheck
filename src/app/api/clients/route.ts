import { randomUUID } from "crypto";
import { db, ensureDatabaseCompatibility } from "@/db";
import { clients } from "@/db/schema";
import { publish } from "@/lib/bus";
import { logActivity, resolveActor } from "@/lib/collab";
import { toClient } from "@/lib/mappers";
import { emptyChecks } from "@/lib/steps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureDatabaseCompatibility();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Corpo inválido." }, { status: 400 });
    }
    const raw = body as {
      name?: unknown;
      economicGroup?: unknown;
      attendanceUnit?: unknown;
      attendanceUnits?: unknown;
      phone?: unknown;
      notes?: unknown;
      actor?: unknown;
    };
    const actor = await resolveActor(
      (raw?.actor as { id?: unknown; name?: unknown }) ?? {},
    );
    if (!actor) {
      return Response.json(
        { error: "Identifique-se para adicionar clientes." },
        { status: 400 },
      );
    }
    const name = typeof raw?.name === "string" ? raw.name.trim() : "";
    if (!name || name.length > 100) {
      return Response.json({ error: "Nome inválido." }, { status: 400 });
    }
    const economicGroup =
      typeof raw?.economicGroup === "string" ? raw.economicGroup.trim() : "";
    const attendanceUnits = Array.isArray(raw?.attendanceUnits)
      ? raw.attendanceUnits
          .filter((unit): unit is string => typeof unit === "string")
          .map((unit) => unit.trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 20)
      : typeof raw?.attendanceUnit === "string" && raw.attendanceUnit.trim()
        ? [raw.attendanceUnit.trim().slice(0, 80)]
        : [];
    const attendanceUnit = attendanceUnits[0] ?? "";
    const phone = typeof raw?.phone === "string" ? raw.phone.trim() : "";
    const notes = typeof raw?.notes === "string" ? raw.notes.trim() : "";

    const [row] = await db
      .insert(clients)
      .values({
        id: randomUUID(),
        name,
        economicGroup: economicGroup || null,
        attendanceUnit: attendanceUnit || null,
        attendanceUnits,
        phone: phone || null,
        notes: notes || null,
        checks: emptyChecks(),
      })
      .returning();
    const activity = await logActivity({
      actor,
      clientId: row.id,
      clientName: row.name,
      action: "created",
    });
    publish({ type: "change", activity });
    return Response.json({ client: toClient(row) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
