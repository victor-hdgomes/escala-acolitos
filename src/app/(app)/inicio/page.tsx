import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  Link2,
  Repeat2,
  Users,
} from "lucide-react";

import { ClaimNameCard } from "@/components/organisms/people/claim-name-card";
import { ScheduleStatusBadge } from "@/components/organisms/schedules/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canManage, requireSession } from "@/lib/auth";
import {
  formatFullDate,
  formatTime,
  monthLabel,
  relativeDays,
  weekdayLong,
} from "@/lib/date";
import type { Schedule } from "@/lib/db/types";
import { isPast } from "@/lib/now";
import { loadMyMasses } from "@/lib/schedule/my-masses";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Início" };

export default async function HomePage() {
  const ctx = await requireSession();
  const admin = createAdminClient();
  const tz = ctx.parish.timezone;
  const manager = canManage(ctx) && ctx.effectiveRole !== "member";

  const masses = ctx.person
    ? await loadMyMasses(ctx.person.id, ctx.parish.id)
    : [];
  const next = masses[0];

  const { data: schedules } = await admin
    .from("schedules")
    .select("*")
    .eq("parish_id", ctx.parish.id)
    .order("month", { ascending: false })
    .limit(1);
  const current = (schedules?.[0] ?? null) as Schedule | null;

  // Substituições abertas no grupo — a coisa mais urgente que existe no app.
  const { data: openSwaps } = await admin
    .from("swap_requests")
    .select("id, token, assignment_id")
    .eq("status", "open")
    .limit(20);

  const assignmentIds = (openSwaps ?? []).map((s) => s.assignment_id);
  const { data: swapAssignments } = assignmentIds.length
    ? await admin
        .from("assignments")
        .select("id, event_id, person_id")
        .in("id", assignmentIds)
    : { data: [] };
  const { data: swapEvents } = swapAssignments?.length
    ? await admin
        .from("events")
        .select("id, starts_at, location_id, schedule_id")
        .in(
          "id",
          swapAssignments.map((a) => a.event_id),
        )
    : { data: [] };
  const { data: locations } = await admin
    .from("locations")
    .select("id, name")
    .eq("parish_id", ctx.parish.id);
  const { data: parishSchedules } = await admin
    .from("schedules")
    .select("id")
    .eq("parish_id", ctx.parish.id);

  const parishScheduleIds = new Set((parishSchedules ?? []).map((s) => s.id));
  const locationName = new Map((locations ?? []).map((l) => [l.id, l.name]));
  const eventById = new Map((swapEvents ?? []).map((e) => [e.id, e]));
  const assignmentById = new Map((swapAssignments ?? []).map((a) => [a.id, a]));

  const swaps = (openSwaps ?? [])
    .map((s) => {
      const assignment = assignmentById.get(s.assignment_id);
      const event = assignment ? eventById.get(assignment.event_id) : null;
      if (!event || !parishScheduleIds.has(event.schedule_id)) return null;
      if (isPast(event.starts_at)) return null;
      return {
        token: s.token,
        startsAt: event.starts_at,
        locationName: locationName.get(event.location_id) ?? "—",
        isMine: assignment?.person_id === ctx.person?.id,
      };
    })
    .filter((s): s is NonNullable<typeof s> => !!s)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Olá, {ctx.person?.full_name ?? ctx.displayName}
        </h1>
        <p className="text-sm text-muted-foreground">{ctx.parish.name}</p>
      </header>

      {swaps.length ? (
        <Card className="border-[color:var(--color-pending)]/50 bg-[color:var(--color-pending)]/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Repeat2 className="h-4 w-4 text-[color:var(--color-pending)]" />
              Precisam de substituição
            </CardTitle>
            <CardDescription>
              Alguém do grupo não vai conseguir. Dá para assumir?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {swaps.map((s) => (
              <Button
                key={s.token}
                variant="outline"
                asChild
                className="h-auto w-full justify-start bg-background px-3 py-2"
              >
                <Link href={`/t/${s.token}`}>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm">
                      {weekdayLong(s.startsAt, tz)} ·{" "}
                      {formatTime(s.startsAt, tz)} · {s.locationName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {relativeDays(s.startsAt, tz)}
                      {s.isMine ? " · seu pedido" : ""}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!ctx.person ? (
        <ClaimNameCardLoader parishId={ctx.parish.id} />
      ) : next ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck2 className="h-4 w-4 text-[color:var(--color-filled)]" />
              Sua próxima missa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium">
                {weekdayLong(next.startsAt, tz)},{" "}
                {formatFullDate(next.startsAt, tz)} às{" "}
                {formatTime(next.startsAt, tz)}
              </p>
              <p className="text-sm text-muted-foreground">
                {next.locationName}
                {next.label ? ` · ${next.label}` : ""}
              </p>
            </div>
            <Badge variant="secondary">{relativeDays(next.startsAt, tz)}</Badge>
            <Button variant="outline" asChild className="w-full">
              <Link href="/minhas-missas">
                Ver todas as minhas missas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Você não está escalado em nenhuma missa publicada.
          </CardContent>
        </Card>
      )}

      {manager ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coordenação</CardTitle>
            <CardDescription>
              {current
                ? `Última escala: ${monthLabel(current.month)}`
                : "Nenhuma escala criada ainda."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {current ? (
              <Button
                variant="outline"
                asChild
                className="h-auto w-full justify-start px-3 py-2"
              >
                <Link href={`/escalas/${current.id}`}>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-2 text-sm">
                      {monthLabel(current.month)}
                      <ScheduleStatusBadge status={current.status} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {current.availability_deadline
                        ? `Prazo ${formatFullDate(current.availability_deadline, tz)}`
                        : "Sem prazo definido"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              </Button>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="ghost" asChild className="justify-start">
                <Link href="/escalas">
                  <Link2 className="h-4 w-4" />
                  Escalas
                </Link>
              </Button>
              <Button variant="ghost" asChild className="justify-start">
                <Link href="/pessoas">
                  <Users className="h-4 w-4" />
                  Acólitos
                </Link>
              </Button>
              <Button variant="ghost" asChild className="justify-start">
                <Link href="/estatisticas">
                  <AlertTriangle className="h-4 w-4" />
                  Estatísticas
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

async function ClaimNameCardLoader({ parishId }: { parishId: string }) {
  const admin = createAdminClient();
  const { data: people } = await admin
    .from("people")
    .select("id, full_name, claimed_by")
    .eq("parish_id", parishId)
    .eq("active", true)
    .order("full_name", { ascending: true });

  return (
    <ClaimNameCard
      people={(people ?? []).map((p) => ({
        id: p.id,
        name: p.full_name,
        claimed: !!p.claimed_by,
      }))}
    />
  );
}
