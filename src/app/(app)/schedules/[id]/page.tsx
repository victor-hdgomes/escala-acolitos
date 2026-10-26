import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ScheduleDetailView } from "@/components/organisms/schedules/schedule-detail";
import { requireManager } from "@/lib/auth";
import type { Location } from "@/lib/db/types";
import { appUrl } from "@/lib/public-access";
import {
  loadBusyDaysFromOtherSchedules,
  loadPersonStats,
  loadScheduleDetail,
  toLite,
} from "@/lib/schedule/queries";
import type { PersonStats } from "@/lib/schedule/suggest";
import { getDateFormatter } from "@/lib/server-date";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata() {
  const t = await getTranslations("schedules.detail");
  return { title: t("title") };
}

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireManager();
  const admin = createAdminClient();

  const detail = await loadScheduleDetail(admin, id, { withAvailability: true });
  if (!detail || detail.schedule.parish_id !== ctx.parish.id) notFound();

  const allEvents = detail.days.flatMap((d) => d.events);
  const range = allEvents.length
    ? {
        from: allEvents[0].starts_at,
        to: allEvents[allEvents.length - 1].starts_at,
      }
    : null;

  const [
    { data: people },
    { data: locations },
    { count: templateCount },
    { statsById, byLocation },
    busyByDay,
    df,
  ] = await Promise.all([
      admin
        .from("people")
        .select("*")
        .eq("parish_id", ctx.parish.id)
        .order("full_name", { ascending: true }),
      admin
        .from("locations")
        .select("*")
        .eq("parish_id", ctx.parish.id)
        .order("sort_order", { ascending: true }),
      // An empty schedule can offer to generate itself only if there is a
      // weekly pattern to generate it from. Without this the empty state
      // tells a group that has one that it has none.
      admin
        .from("mass_templates")
        .select("id", { count: "exact", head: true })
        .eq("parish_id", ctx.parish.id)
        .eq("active", true),
      loadPersonStats(admin, ctx.parish.id, id),
      loadBusyDaysFromOtherSchedules(
        admin,
        ctx.parish.id,
        id,
        detail.timezone,
        range,
      ),
      getDateFormatter(detail.timezone),
    ]);

  const stats: Record<string, PersonStats> = {};
  for (const [personId, value] of statsById) stats[personId] = value;

  const locationCounts: Record<string, Record<string, number>> = {};
  for (const [personId, perLocation] of byLocation) {
    locationCounts[personId] = Object.fromEntries(perLocation);
  }

  return (
    <ScheduleDetailView
      detail={detail}
      hasTemplates={(templateCount ?? 0) > 0}
      monthTitle={df.monthLabel(detail.schedule.month)}
      people={(people ?? []).map(toLite)}
      locations={((locations ?? []) as Location[]).map((l) => ({
        id: l.id,
        name: l.name,
        short_name: l.short_name,
        color: l.color,
        sort_order: l.sort_order,
      }))}
      stats={stats}
      locationCounts={locationCounts}
      busyByDay={busyByDay}
      fillUrl={appUrl(`/e/${detail.schedule.fill_token}`)}
      viewUrl={appUrl(`/v/${detail.schedule.view_token}`)}
    />
  );
}
