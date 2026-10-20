import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, ChevronRight } from "lucide-react";

import { NewScheduleDialog } from "@/components/organisms/schedules/new-schedule-dialog";
import { ScheduleStatusBadge } from "@/components/organisms/schedules/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireManager } from "@/lib/auth";
import { formatFullDate, monthLabel } from "@/lib/date";
import type { Location, Schedule } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Escalas" };

export default async function SchedulesPage() {
  const ctx = await requireManager();
  const admin = createAdminClient();

  const { data: schedules } = await admin
    .from("schedules")
    .select("*")
    .eq("parish_id", ctx.parish.id)
    .order("month", { ascending: false });

  const rows = (schedules ?? []) as Schedule[];

  // Contagem por escala para a linha de resumo, numa query só.
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
          <h1 className="text-xl font-semibold tracking-tight">Escalas</h1>
          <p className="text-sm text-muted-foreground">
            Crie a do mês, mande o link no grupo e acompanhe quem respondeu.
          </p>
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
              Nenhuma escala ainda.
              {(hasTemplates.count ?? 0) === 0 ? (
                <>
                  {" "}
                  Cadastre a grade semanal em{" "}
                  <Link href="/grupo" className="underline underline-offset-4">
                    Grupo
                  </Link>{" "}
                  para o mês vir pronto.
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
              <Link href={`/escalas/${s.id}`}>
                <div className="min-w-0 flex-1 text-left">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <span className="truncate">
                      {s.kind === "monthly" ? monthLabel(s.month) : s.title}
                    </span>
                    <ScheduleStatusBadge status={s.status} />
                    {s.kind !== "monthly" ? (
                      <Badge
                        variant="secondary"
                        className="shrink-0 bg-[color:var(--color-novena)]/15 text-[color:var(--color-novena)]"
                      >
                        {s.kind === "novena" ? "novena" : "especial"}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.kind !== "monthly" ? `${monthLabel(s.month)} · ` : ""}
                    {total} {total === 1 ? "celebração" : "celebrações"} ·{" "}
                    {filled} {filled === 1 ? "escalação" : "escalações"}
                    {s.availability_deadline
                      ? ` · prazo ${formatFullDate(s.availability_deadline, ctx.parish.timezone)}`
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
