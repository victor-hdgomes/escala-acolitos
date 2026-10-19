import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface MyMass {
  assignmentId: string;
  eventId: string;
  scheduleId: string;
  scheduleStatus: string;
  viewToken: string;
  startsAt: string;
  locationName: string;
  locationColor: string;
  label: string | null;
  position: number;
  swapOpen: boolean;
  swapId: string | null;
  swapToken: string | null;
}

/**
 * As missas de uma pessoa, da mais próxima para a mais distante.
 *
 * Só escalas publicadas: enquanto o coordenador monta, a escalação ainda pode
 * mudar e avisar antes da hora só gera confusão.
 */
export async function loadMyMasses(
  personId: string,
  parishId: string,
  { includePast = false }: { includePast?: boolean } = {},
): Promise<MyMass[]> {
  const admin = createAdminClient();

  const { data: assignments } = await admin
    .from("assignments")
    .select("id, event_id, position")
    .eq("person_id", personId);
  if (!assignments?.length) return [];

  const { data: events } = await admin
    .from("events")
    .select("id, schedule_id, starts_at, location_id, label")
    .in(
      "id",
      assignments.map((a) => a.event_id),
    );
  if (!events?.length) return [];

  const { data: schedules } = await admin
    .from("schedules")
    .select("id, status, view_token, parish_id")
    .in("id", [...new Set(events.map((e) => e.schedule_id))])
    .eq("parish_id", parishId);

  const scheduleById = new Map((schedules ?? []).map((s) => [s.id, s]));

  const { data: locations } = await admin
    .from("locations")
    .select("id, name, color")
    .eq("parish_id", parishId);
  const locationById = new Map((locations ?? []).map((l) => [l.id, l]));

  const { data: swaps } = await admin
    .from("swap_requests")
    .select("id, assignment_id, token")
    .in(
      "assignment_id",
      assignments.map((a) => a.id),
    )
    .eq("status", "open");
  const swapByAssignment = new Map(
    (swaps ?? []).map((s) => [s.assignment_id, { id: s.id, token: s.token }]),
  );

  const eventById = new Map(events.map((e) => [e.id, e]));
  const now = Date.now();

  return assignments
    .map((a): MyMass | null => {
      const event = eventById.get(a.event_id);
      if (!event) return null;
      const schedule = scheduleById.get(event.schedule_id);
      if (!schedule || schedule.status !== "published") return null;
      if (!includePast && Date.parse(event.starts_at) < now) return null;

      const location = locationById.get(event.location_id);
      return {
        assignmentId: a.id,
        eventId: event.id,
        scheduleId: schedule.id,
        scheduleStatus: schedule.status,
        viewToken: schedule.view_token,
        startsAt: event.starts_at,
        locationName: location?.name ?? "—",
        locationColor: location?.color ?? "#888888",
        label: event.label,
        position: a.position,
        swapOpen: swapByAssignment.has(a.id),
        swapId: swapByAssignment.get(a.id)?.id ?? null,
        swapToken: swapByAssignment.get(a.id)?.token ?? null,
      };
    })
    .filter((m): m is MyMass => !!m)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
