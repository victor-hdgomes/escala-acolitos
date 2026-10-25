import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarPlus, ChevronRight } from "lucide-react";

import { NewScheduleDialog } from "@/components/organisms/schedules/new-schedule-dialog";
import { ScheduleStatusBadge } from "@/components/organisms/schedules/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireManager } from "@/lib/auth";
import type { Location, Schedule } from "@/lib/db/types";
import { getDateFormatter } from "@/lib/server-date";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata() {
  const t = await getTranslations("schedules.list");
  return { title: t("title") };
}

export default async function SchedulesPage() {
  const ctx = await requireManager();
  const admin = createAdminClient();
  const t = await getTranslations("schedules");
  const df = await getDateFormatter(ctx.parish.timezone);

  const { data: schedules } = await admin
    .from("schedules")
    .select("*")
    .eq("parish_id", ctx.parish.id)
    .order("month", { ascending: false });

  const rows = (schedules ?? []) as Schedule[];

  // Counts for the summary line of every row, in a single query.
  const ids = rows.map((s) => s.id);
  const { data: events } = ids.length
    ? await admin.from("events").select("id, schedule_id").in("schedule_id", ids)
    : { data: [] };
  const eventIds = (events ?? []).map((e) => e.id);
  const { data: assignments } = eventIds.length
    ? await admin.from("assignments").select("event_id").in("event_id", eventIds)
    : { data: [] };

  const scheduleByEvent = new Map((events ?? []).map((e) => [e.id, e.schedule_id]));
  const eventCount = new Map<string, number>();
  for (const e of events ?? []) {
    eventCount.set(e.schedule_id, (eventCount.get(e.schedule_id) ?? 0) + 1);
  }
  const assignCount = new Map<string, number>();
  for (const a of assignments ?? []) {
    const sid = scheduleByEvent.get(a.event_id);
    if (sid) assignCount.set(sid, (assignCount.get(sid) ?? 0) + 1);
  }

  const [hasTemplates, { data: locations }] = await Promise.all([
    admin
      .from("mass_templates")
      .select("id", { count: "exact", head: true })
      .eq("parish_id", ctx.parish.id)
      .eq("active", true),
    admin
      .from("locations")
      .select("*")
      .eq("parish_id", ctx.parish.id)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("list.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("list.subtitle")}</p>
        </div>
        <NewScheduleDialog
          hasTemplates={(hasTemplates.count ?? 0) > 0}
          timezone={ctx.parish.timezone}
          locations={((locations ?? []) as Location[]).map((l) => ({
            id: l.id,
            name: l.name,
            short_name: l.short_name,
            color: l.color,
            sort_order: l.sort_order,
          }))}
        />
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarPlus className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("list.emptyState")}
              {(hasTemplates.count ?? 0) === 0 ? (
                <>
                  {" "}
                  {t.rich("list.emptyHint", {
                    link: (chunks) => (
                      <Link href="/group" className="underline underline-offset-4">
                        {chunks}
                      </Link>
                    ),
                  })}
                </>
              ) : null}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        {rows.map((s) => {
          const total = eventCount.get(s.id) ?? 0;
          const filled = assignCount.get(s.id) ?? 0;
          return (
            <Button
              key={s.id}
              variant="outline"
              asChild
              className="h-auto w-full justify-start px-4 py-3"
            >
              <Link href={`/schedules/${s.id}`}>
                <div className="min-w-0 flex-1 text-left">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <span className="truncate">
                      {s.kind === "monthly" ? df.monthLabel(s.month) : s.title}
                    </span>
                    <ScheduleStatusBadge status={s.status} />
                    {s.kind !== "monthly" ? (
                      <Badge
                        variant="secondary"
                        className="shrink-0 bg-[color:var(--color-novena)]/15 text-[color:var(--color-novena)]"
                      >
                        {s.kind === "novena"
                          ? t("badges.novena")
                          : t("badges.special")}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.kind !== "monthly" ? `${df.monthLabel(s.month)} · ` : ""}
                    {t("celebrationCount", { count: total })} ·{" "}
                    {t("assignmentCount", { count: filled })}
                    {s.availability_deadline
                      ? ` · ${t("list.deadlineSummary", {
                          date: df.fullDate(s.availability_deadline),
                        })}`
                      : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
