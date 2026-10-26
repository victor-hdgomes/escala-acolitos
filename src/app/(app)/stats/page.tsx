import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StatsView } from "@/components/organisms/stats/stats-view";
import type { StatCell, StatRow } from "@/components/organisms/stats/stats-view";
import { requireManager } from "@/lib/auth";
import { nowMs } from "@/lib/now";
import { getDateFormatter } from "@/lib/server-date";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("stats");
  return { title: t("metaTitle") };
}

/**
 * Who serves a lot, who serves little, who has disappeared. The question
 * nobody can answer today by staring at the spreadsheet.
 *
 * The totals are not computed here. Each person arrives with their turns
 * broken down by month and by place, and the screen adds them up for whatever
 * window and whichever chapel the coordinator is looking at. A parish has
 * tens of people and hundreds of turns, so that costs nothing to send and
 * saves a round trip on every change of filter.
 */
export default async function StatsPage() {
  const ctx = await requireManager();
  const admin = createAdminClient();
  const df = await getDateFormatter(ctx.parish.timezone);

  const [{ data: people }, { data: locations }, { data: schedules }] =
    await Promise.all([
      admin
        .from("people")
        .select("id, full_name, active")
        .eq("parish_id", ctx.parish.id),
      admin
        .from("locations")
        .select("id, name, color")
        .eq("parish_id", ctx.parish.id)
        .order("sort_order", { ascending: true }),
      admin
        .from("schedules")
        .select("id, month, status")
        .eq("parish_id", ctx.parish.id)
        .order("month", { ascending: true }),
    ]);

  const scheduleIds = (schedules ?? []).map((s) => s.id);
  const { data: events } = scheduleIds.length
    ? await admin
        .from("events")
        .select("id, schedule_id, location_id, starts_at")
        .in("schedule_id", scheduleIds)
    : { data: [] };

  const eventIds = (events ?? []).map((e) => e.id);
  const [{ data: assignments }, { data: availabilities }] = await Promise.all([
    eventIds.length
      ? admin.from("assignments").select("person_id, event_id").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
    eventIds.length
      ? admin
          .from("availabilities")
          .select("person_id, event_id")
          .in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);

  const eventById = new Map((events ?? []).map((e) => [e.id, e]));
  const monthBySchedule = new Map((schedules ?? []).map((s) => [s.id, s.month]));
  const now = nowMs();

  /** Turns and marks, keyed by "month|location" so one pass fills both. */
  function tally(rows: Array<{ person_id: string; event_id: string }> | null) {
    const byPerson = new Map<string, Map<string, number>>();
    for (const row of rows ?? []) {
      const event = eventById.get(row.event_id);
      if (!event) continue;
      const month = monthBySchedule.get(event.schedule_id);
      if (!month) continue;
      const key = `${month}|${event.location_id}`;
      const cells = byPerson.get(row.person_id) ?? new Map<string, number>();
      cells.set(key, (cells.get(key) ?? 0) + 1);
      byPerson.set(row.person_id, cells);
    }
    return byPerson;
  }

  const servedCells = tally(assignments);
  const answeredCells = tally(availabilities);

  const lastServed = new Map<string, string>();
  for (const a of assignments ?? []) {
    const event = eventById.get(a.event_id);
    if (!event || Date.parse(event.starts_at) > now) continue;
    const previous = lastServed.get(a.person_id);
    if (!previous || event.starts_at > previous) {
      lastServed.set(a.person_id, event.starts_at);
    }
  }

  const toCells = (cells: Map<string, number> | undefined): StatCell[] =>
    [...(cells ?? new Map()).entries()].map(([key, count]) => {
      const [month, locationId] = key.split("|");
      return { month, locationId, count };
    });

  const rows: StatRow[] = (people ?? [])
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      name: p.full_name,
      served: toCells(servedCells.get(p.id)),
      answered: toCells(answeredCells.get(p.id)),
      daysSinceLast: lastServed.has(p.id)
        ? Math.floor((now - Date.parse(lastServed.get(p.id)!)) / 86_400_000)
        : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, df.locale));

  const months = (schedules ?? [])
    .map((s) => s.month)
    .filter((month, i, all) => all.indexOf(month) === i)
    .sort()
    .map((month) => ({ iso: month, label: df.monthLabel(month) }));

  return (
    <StatsView
      rows={rows}
      months={months}
      locations={(locations ?? []).map((l) => ({ id: l.id, name: l.name }))}
    />
  );
}
