import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  Link2,
  Repeat2,
  Users,
} from "lucide-react";

import { SetupChecklist } from "@/components/organisms/onboarding/setup-checklist";
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
import type { Schedule } from "@/lib/db/types";
import { isPast } from "@/lib/now";
import { loadMyMasses } from "@/lib/schedule/my-masses";
import { getDateFormatter } from "@/lib/server-date";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return { title: t("title") };
}

export default async function HomePage() {
  const ctx = await requireSession();
  const t = await getTranslations("home");
  const df = await getDateFormatter(ctx.parish.timezone);
  const admin = createAdminClient();
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

  // What the group still has to set up. Counted only for someone who could
  // act on it, and head:true so this is four cheap counts and no rows.
  const setup = manager
    ? await loadSetupProgress(ctx.parish.id)
    : null;

  // Open cover requests in the group - the most urgent thing in the app.
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
        locationName: locationName.get(event.location_id) ?? "-",
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
          {t("greeting", {
            name: ctx.person?.full_name ?? ctx.displayName,
          })}
        </h1>
        <p className="text-sm text-muted-foreground">{ctx.parish.name}</p>
      </header>

      {setup ? <SetupChecklist {...setup} /> : null}

      {swaps.length ? (
        <Card className="border-[color:var(--color-pending)]/50 bg-[color:var(--color-pending)]/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Repeat2 className="h-4 w-4 text-[color:var(--color-pending)]" />
              {t("swaps.title")}
            </CardTitle>
            <CardDescription>{t("swaps.description")}</CardDescription>
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
                      {t("swaps.when", {
                        weekday: df.weekday(s.startsAt),
                        time: df.time(s.startsAt),
                        place: s.locationName,
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.isMine
                        ? t("swaps.relativeOwn", {
                            relative: df.relativeDays(s.startsAt),
                          })
                        : df.relativeDays(s.startsAt)}
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
              {t("nextMass.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium">
                {t("nextMass.when", {
                  weekday: df.weekday(next.startsAt),
                  date: df.fullDate(next.startsAt),
                  time: df.time(next.startsAt),
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {next.label
                  ? t("nextMass.placeWithLabel", {
                      place: next.locationName,
                      label: next.label,
                    })
                  : next.locationName}
              </p>
            </div>
            <Badge variant="secondary">{df.relativeDays(next.startsAt)}</Badge>
            <Button variant="outline" asChild className="w-full">
              <Link href="/my-masses">
                {t("nextMass.seeAll")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("emptyState")}
          </CardContent>
        </Card>
      )}

      {manager ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("management.title")}</CardTitle>
            <CardDescription>
              {current
                ? t("management.lastSchedule", {
                    month: df.monthLabel(current.month),
                  })
                : t("management.emptyState")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {current ? (
              <Button
                variant="outline"
                asChild
                className="h-auto w-full justify-start px-3 py-2"
              >
                <Link href={`/schedules/${current.id}`}>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-2 text-sm">
                      {df.monthLabel(current.month)}
                      <ScheduleStatusBadge status={current.status} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {current.availability_deadline
                        ? t("management.deadline", {
                            date: df.fullDate(current.availability_deadline),
                          })
                        : t("management.noDeadline")}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              </Button>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="ghost" asChild className="justify-start">
                <Link href="/schedules">
                  <Link2 className="h-4 w-4" />
                  {t("management.schedules")}
                </Link>
              </Button>
              <Button variant="ghost" asChild className="justify-start">
                <Link href="/people">
                  <Users className="h-4 w-4" />
                  {t("management.people")}
                </Link>
              </Button>
              <Button variant="ghost" asChild className="justify-start">
                <Link href="/stats">
                  <AlertTriangle className="h-4 w-4" />
                  {t("management.stats")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * The four counts behind the setup guide. A group is ready when all four are
 * above zero, and until then the guide is the first thing on this page.
 */
async function loadSetupProgress(parishId: string) {
  const admin = createAdminClient();
  const count = async (table: "locations" | "mass_templates" | "people" | "schedules") => {
    const { count: rows } = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("parish_id", parishId);
    return rows ?? 0;
  };

  const [locations, templates, people, schedules] = await Promise.all([
    count("locations"),
    count("mass_templates"),
    count("people"),
    count("schedules"),
  ]);
  return { locations, templates, people, schedules };
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
