import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StatsView } from "@/components/organisms/stats/stats-view";
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
  const scheduleById = new Map((schedules ?? []).map((s) => [s.id, s]));
  const now = nowMs();

  const served = new Map<string, number>();
  const perLocation = new Map<string, Map<string, number>>();
  const perMonth = new Map<string, number>();
  const lastServed = new Map<string, string>();

  for (const a of assignments ?? []) {
    const event = eventById.get(a.event_id);
    if (!event) continue;
    served.set(a.person_id, (served.get(a.person_id) ?? 0) + 1);

    const loc = perLocation.get(a.person_id) ?? new Map<string, number>();
    loc.set(event.location_id, (loc.get(event.location_id) ?? 0) + 1);
    perLocation.set(a.person_id, loc);

    const schedule = scheduleById.get(event.schedule_id);
    if (schedule) {
      perMonth.set(schedule.month, (perMonth.get(schedule.month) ?? 0) + 1);
    }

    if (Date.parse(event.starts_at) <= now) {
      const prev = lastServed.get(a.person_id);
      if (!prev || event.starts_at > prev) {
        lastServed.set(a.person_id, event.starts_at);
      }
    }
  }

  const answered = new Map<string, number>();
  for (const av of availabilities ?? []) {
    answered.set(av.person_id, (answered.get(av.person_id) ?? 0) + 1);
  }

  const rows = (people ?? [])
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      name: p.full_name,
      served: served.get(p.id) ?? 0,
      answered: answered.get(p.id) ?? 0,
      daysSinceLast: lastServed.has(p.id)
        ? Math.floor((now - Date.parse(lastServed.get(p.id)!)) / 86_400_000)
        : null,
      topLocation: (() => {
        const loc = perLocation.get(p.id);
        if (!loc) return null;
        const best = [...loc.entries()].sort((a, b) => b[1] - a[1])[0];
        return (locations ?? []).find((l) => l.id === best[0])?.name ?? null;
      })(),
    }))
    .sort(
      (a, b) => b.served - a.served || a.name.localeCompare(b.name, df.locale),
    );

  const months = [...perMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ label: df.monthLabel(month), count }));

  return <StatsView rows={rows} months={months} />;
}
