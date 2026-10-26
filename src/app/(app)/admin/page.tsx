import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Building2, CalendarRange, MessageSquare, Users } from "lucide-react";

import { FeedbackInbox } from "@/components/organisms/admin/feedback-inbox";
import type { FeedbackRow } from "@/components/organisms/admin/feedback-inbox";
import { TimeZoneProvider } from "@/components/providers/timezone-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireSuperadmin } from "@/lib/auth";
import type { Feedback, Parish } from "@/lib/db/types";
import { getDateFormatter } from "@/lib/server-date";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin"))("title") };
}

/**
 * The whole installation on one screen, for the one account that may see it.
 *
 * Everything here is read only on purpose. The owner needs to know which
 * parishes actually took, which opened a group and never built a schedule,
 * and what people are writing in; changing another parish's data from here
 * would be acting inside a group whose coordinator never asked for help.
 */
export default async function AdminPage() {
  const ctx = await requireSuperadmin();
  const admin = createAdminClient();
  const [t, df] = await Promise.all([
    getTranslations("admin"),
    getDateFormatter(ctx.parish.timezone),
  ]);

  const [
    { data: parishes },
    { data: memberships },
    { data: people },
    { data: schedules },
    { data: profiles },
    { data: feedback },
  ] = await Promise.all([
    admin.from("parishes").select("*").order("created_at", { ascending: false }),
    admin.from("memberships").select("parish_id"),
    admin.from("people").select("parish_id, claimed_by"),
    admin.from("schedules").select("parish_id, status, created_at"),
    admin.from("profiles").select("id, display_name, email"),
    admin
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const tally = <T,>(rows: T[] | null, key: (row: T) => string | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      const id = key(row);
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  };

  const memberCount = tally(memberships, (m) => m.parish_id);
  const peopleCount = tally(people, (p) => p.parish_id);
  const scheduleCount = tally(schedules, (s) => s.parish_id);
  const claimedCount = tally(people, (p) => (p.claimed_by ? p.parish_id : null));

  const lastSchedule = new Map<string, string>();
  for (const s of schedules ?? []) {
    const current = lastSchedule.get(s.parish_id);
    if (!current || s.created_at > current) {
      lastSchedule.set(s.parish_id, s.created_at);
    }
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const parishById = new Map(
    ((parishes ?? []) as Parish[]).map((p) => [p.id, p.name]),
  );

  const inbox: FeedbackRow[] = ((feedback ?? []) as Feedback[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    message: row.message,
    page: row.page,
    status: row.status,
    createdLabel: df.fullDate(row.created_at),
    parishName: row.parish_id ? (parishById.get(row.parish_id) ?? null) : null,
    authorName: row.user_id
      ? (profileById.get(row.user_id)?.display_name ?? null)
      : null,
    contactEmail:
      row.contact_email ??
      (row.user_id ? (profileById.get(row.user_id)?.email ?? null) : null),
  }));

  const rows = (parishes ?? []) as Parish[];
  const totals = [
    { key: "parishes", icon: Building2, value: rows.length },
    { key: "accounts", icon: Users, value: (profiles ?? []).length },
    { key: "schedules", icon: CalendarRange, value: (schedules ?? []).length },
    {
      key: "feedback",
      icon: MessageSquare,
      value: inbox.filter((f) => f.status === "new").length,
    },
  ] as const;

  return (
    <TimeZoneProvider timeZone={ctx.parish.timezone}>
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {totals.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.key}>
                <CardContent className="py-4">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {item.value}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`totals.${item.key}`)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("groups.title")}</CardTitle>
            <CardDescription>{t("groups.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("groups.empty")}
              </p>
            ) : null}
            {rows.map((parish, i) => {
              const servers = peopleCount.get(parish.id) ?? 0;
              const built = scheduleCount.get(parish.id) ?? 0;
              return (
                <div key={parish.id}>
                  {i > 0 ? <Separator /> : null}
                  <div className="flex flex-wrap items-center gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {parish.name}{" "}
                        {parish.fill_access === "members" ? (
                          <Badge variant="secondary">
                            {t("groups.membersOnly")}
                          </Badge>
                        ) : null}
                        {built === 0 ? (
                          <Badge variant="outline">
                            {t("groups.neverBuilt")}
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("groups.counts", {
                          members: memberCount.get(parish.id) ?? 0,
                          servers,
                          claimed: claimedCount.get(parish.id) ?? 0,
                          schedules: built,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("groups.created", {
                          date: df.fullDate(parish.created_at),
                        })}
                        {lastSchedule.has(parish.id)
                          ? ` · ${t("groups.lastSchedule", {
                              date: df.fullDate(lastSchedule.get(parish.id)!),
                            })}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <FeedbackInbox rows={inbox} />
      </div>
    </TimeZoneProvider>
  );
}
