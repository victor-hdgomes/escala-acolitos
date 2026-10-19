import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ScheduleDetailView } from "@/components/organisms/schedules/schedule-detail";
import { requireManager } from "@/lib/auth";
import { monthLabel } from "@/lib/date";
import type { Location } from "@/lib/db/types";
import { appUrl } from "@/lib/public-access";
import { loadPersonStats, loadScheduleDetail, toLite } from "@/lib/schedule/queries";
import type { PersonStats } from "@/lib/schedule/suggest";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Escala" };

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

  const [{ data: people }, { data: locations }, { statsById, byLocation }] =
    await Promise.all([
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
      loadPersonStats(admin, ctx.parish.id, id),
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
      monthTitle={monthLabel(detail.schedule.month)}
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
      fillUrl={appUrl(`/e/${detail.schedule.fill_token}`)}
      viewUrl={appUrl(`/v/${detail.schedule.view_token}`)}
    />
  );
}
