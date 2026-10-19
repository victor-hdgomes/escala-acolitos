import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { dayKey, formatDayMonth, weekdayLong } from "@/lib/date";
import type {
  Assignment,
  Availability,
  Database,
  EventRow,
  Location,
  Person,
  Schedule,
  SwapRequest,
} from "@/lib/db/types";
import type { PersonStats } from "@/lib/schedule/suggest";
import type {
  DayGroup,
  EventView,
  LocationLite,
  PersonLite,
  ScheduleDetail,
  SlotView,
} from "@/lib/schedule/types";

export type Db = SupabaseClient<Database>;

export function toLite(p: Person): PersonLite {
  return {
    id: p.id,
    full_name: p.full_name,
    short_name: p.short_name,
    claimed_by: p.claimed_by,
    active: p.active,
  };
}

function locationLite(l: Location): LocationLite {
  return {
    id: l.id,
    name: l.name,
    short_name: l.short_name,
    color: l.color,
    sort_order: l.sort_order,
  };
}

/**
 * Monta a escala inteira numa estrutura pronta para renderizar.
 *
 * Faz várias queries pequenas em vez de um join aninhado: o tipo do
 * supabase-js para join embutido é frágil e a escala de um mês tem ~40
 * celebrações, então o custo é irrelevante e o código fica legível.
 */
export async function loadScheduleDetail(
  db: Db,
  scheduleId: string,
  opts: { withAvailability?: boolean } = {},
): Promise<ScheduleDetail | null> {
  const { data: schedule } = await db
    .from("schedules")
    .select("*")
    .eq("id", scheduleId)
    .maybeSingle();
  if (!schedule) return null;

  const [{ data: parish }, { data: events }, { data: locations }, { data: people }] =
    await Promise.all([
      db.from("parishes").select("*").eq("id", schedule.parish_id).single(),
      db
        .from("events")
        .select("*")
        .eq("schedule_id", scheduleId)
        .order("starts_at", { ascending: true }),
      db.from("locations").select("*").eq("parish_id", schedule.parish_id),
      db.from("people").select("*").eq("parish_id", schedule.parish_id),
    ]);

  const timezone = parish?.timezone ?? "America/Sao_Paulo";
  const eventRows = (events ?? []) as EventRow[];
  const eventIds = eventRows.map((e) => e.id);

  const [{ data: assignments }, { data: availabilities }] = await Promise.all([
    eventIds.length
      ? db.from("assignments").select("*").in("event_id", eventIds)
      : Promise.resolve({ data: [] as Assignment[] }),
    opts.withAvailability && eventIds.length
      ? db.from("availabilities").select("*").in("event_id", eventIds)
      : Promise.resolve({ data: [] as Availability[] }),
  ]);

  const assignmentRows = (assignments ?? []) as Assignment[];
  const assignmentIds = assignmentRows.map((a) => a.id);
  const { data: swaps } = assignmentIds.length
    ? await db
        .from("swap_requests")
        .select("*")
        .in("assignment_id", assignmentIds)
        .eq("status", "open")
    : { data: [] as SwapRequest[] };

  const peopleById = new Map(
    ((people ?? []) as Person[]).map((p) => [p.id, toLite(p)]),
  );
  const locationsById = new Map(
    ((locations ?? []) as Location[]).map((l) => [l.id, locationLite(l)]),
  );
  const swapByAssignment = new Map(
    ((swaps ?? []) as SwapRequest[]).map((s) => [s.assignment_id, s]),
  );

  const assignmentsByEvent = new Map<string, Assignment[]>();
  for (const a of assignmentRows) {
    const list = assignmentsByEvent.get(a.event_id) ?? [];
    list.push(a);
    assignmentsByEvent.set(a.event_id, list);
  }

  const availByEvent = new Map<string, PersonLite[]>();
  for (const av of (availabilities ?? []) as Availability[]) {
    const person = peopleById.get(av.person_id);
    if (!person) continue;
    const list = availByEvent.get(av.event_id) ?? [];
    list.push(person);
    availByEvent.set(av.event_id, list);
  }

  const views: EventView[] = eventRows.map((ev) => {
    const mine = assignmentsByEvent.get(ev.id) ?? [];
    const slotsView: SlotView[] = Array.from({ length: ev.slots }, (_, i) => {
      const position = i + 1;
      const a = mine.find((x) => x.position === position);
      const swap = a ? swapByAssignment.get(a.id) : undefined;
      return {
        position,
        assignmentId: a?.id ?? null,
        person: a ? (peopleById.get(a.person_id) ?? null) : null,
        swap: swap
          ? { id: swap.id, token: swap.token, reason: swap.reason }
          : null,
      };
    });

    return {
      id: ev.id,
      starts_at: ev.starts_at,
      label: ev.label,
      kind: ev.kind,
      signup_mode: ev.signup_mode,
      slots: ev.slots,
      location: locationsById.get(ev.location_id) ?? {
        id: ev.location_id,
        name: "—",
        short_name: null,
        color: "#888888",
        sort_order: 99,
      },
      slotsView,
      availablePeople: (availByEvent.get(ev.id) ?? []).sort((a, b) =>
        a.full_name.localeCompare(b.full_name, "pt-BR"),
      ),
    };
  });

  const days: DayGroup[] = [];
  for (const view of views) {
    const key = dayKey(view.starts_at, timezone);
    let group = days.find((d) => d.key === key);
    if (!group) {
      group = {
        key,
        label: formatDayMonth(view.starts_at, timezone),
        weekday: weekdayLong(view.starts_at, timezone),
        events: [],
      };
      days.push(group);
    }
    group.events.push(view);
  }

  return {
    schedule: schedule as Schedule,
    timezone,
    parishName: parish?.name ?? "",
    days,
  };
}

/**
 * Agrega o histórico que alimenta a sugestão.
 *
 * `monthCount` olha só a escala em montagem (é o que o coordenador está
 * equilibrando agora); `recentCount` e `daysSinceLast` olham os últimos 90
 * dias de todas as escalas, para não repetir sempre as mesmas pessoas mês
 * após mês.
 */
export async function loadPersonStats(
  db: Db,
  parishId: string,
  scheduleId: string,
): Promise<{
  statsById: Map<string, PersonStats>;
  byLocation: Map<string, Map<string, number>>;
}> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const [{ data: schedules }, { data: currentEvents }] = await Promise.all([
    db.from("schedules").select("id").eq("parish_id", parishId),
    db.from("events").select("id, location_id").eq("schedule_id", scheduleId),
  ]);

  const scheduleIds = (schedules ?? []).map((s) => s.id);
  const { data: allEvents } = scheduleIds.length
    ? await db
        .from("events")
        .select("id, location_id, starts_at, schedule_id")
        .in("schedule_id", scheduleIds)
    : { data: [] };

  const eventMeta = new Map(
    (allEvents ?? []).map((e) => [
      e.id,
      {
        locationId: e.location_id,
        startsAt: e.starts_at,
        scheduleId: e.schedule_id,
      },
    ]),
  );
  const eventIds = [...eventMeta.keys()];

  const { data: assignments } = eventIds.length
    ? await db.from("assignments").select("person_id, event_id").in("event_id", eventIds)
    : { data: [] };

  const currentEventIds = new Set((currentEvents ?? []).map((e) => e.id));
  const statsById = new Map<string, PersonStats>();
  const byLocation = new Map<string, Map<string, number>>();
  const now = Date.now();

  const ensure = (id: string): PersonStats => {
    let s = statsById.get(id);
    if (!s) {
      s = {
        monthCount: 0,
        recentCount: 0,
        locationCount: 0,
        daysSinceLast: null,
        availabilityCount: 0,
      };
      statsById.set(id, s);
    }
    return s;
  };

  for (const a of assignments ?? []) {
    const meta = eventMeta.get(a.event_id);
    if (!meta) continue;
    const s = ensure(a.person_id);

    if (currentEventIds.has(a.event_id)) s.monthCount += 1;
    if (meta.startsAt >= since && meta.startsAt <= new Date().toISOString()) {
      s.recentCount += 1;
    }

    const started = Date.parse(meta.startsAt);
    if (started <= now) {
      const days = Math.floor((now - started) / 86_400_000);
      if (s.daysSinceLast === null || days < s.daysSinceLast) {
        s.daysSinceLast = days;
      }
    }

    const perLocation = byLocation.get(a.person_id) ?? new Map<string, number>();
    perLocation.set(meta.locationId, (perLocation.get(meta.locationId) ?? 0) + 1);
    byLocation.set(a.person_id, perLocation);
  }

  const { data: avail } = currentEventIds.size
    ? await db
        .from("availabilities")
        .select("person_id")
        .in("event_id", [...currentEventIds])
    : { data: [] };

  for (const row of avail ?? []) ensure(row.person_id).availabilityCount += 1;

  return { statsById, byLocation };
}

/** Lista de acólitos ativos da paróquia, em ordem alfabética. */
export async function loadPeople(db: Db, parishId: string): Promise<Person[]> {
  const { data } = await db
    .from("people")
    .select("*")
    .eq("parish_id", parishId)
    .order("full_name", { ascending: true });
  return (data ?? []) as Person[];
}
