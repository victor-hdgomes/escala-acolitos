import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PublishedView } from "@/components/organisms/published/published-view";
import type { PublishedEvent } from "@/components/organisms/published/published-view";
import { dayKey } from "@/lib/date";
import { nowDate, nowMs } from "@/lib/now";
import { resolveViewToken } from "@/lib/public-access";
import { getDateFormatter } from "@/lib/server-date";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("published");
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default async function PublishedSchedulePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await resolveViewToken(token);
  if (!ctx) notFound();

  const { timezone } = ctx.detail;
  const df = await getDateFormatter(timezone);
  const now = nowMs();

  const days = ctx.detail.days.map((day) => ({
    key: day.key,
    title: df.dayMonth(day.events[0].starts_at),
    weekdayLabel: df.weekday(day.events[0].starts_at),
    events: day.events.map<PublishedEvent>((ev) => ({
      id: ev.id,
      timeLabel: df.time(ev.starts_at),
      locationName: ev.location.name,
      locationColor: ev.location.color,
      label: ev.label,
      isPast: Date.parse(ev.starts_at) < now,
      slots: ev.slotsView.map((s) => ({
        position: s.position,
        assignmentId: s.assignmentId,
        personId: s.person?.id ?? null,
        name: s.person ? (s.person.short_name ?? s.person.full_name) : null,
        claimed: !!s.person?.claimed_by,
        swapOpen: !!s.swap,
        swapToken: s.swap?.token ?? null,
      })),
    })),
  }));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const people = [
    ...new Map(
      ctx.detail.days
        .flatMap((d) => d.events)
        .flatMap((e) => e.slotsView)
        .filter((s) => s.person)
        .map((s) => [
          s.person!.id,
          {
            id: s.person!.id,
            name: s.person!.full_name,
            claimed: !!s.person!.claimed_by,
            isMe: !!user && s.person!.claimed_by === user.id,
          },
        ]),
    ).values(),
    // Sorted in the reader's language: that is where the accent rules live.
  ].sort((a, b) => a.name.localeCompare(b.name, df.locale));

  return (
    <PublishedView
      token={token}
      parishName={ctx.parish.name}
      title={ctx.schedule.title}
      monthTitle={df.monthLabel(ctx.schedule.month)}
      days={days}
      people={people}
      todayKey={dayKey(nowDate(), timezone)}
    />
  );
}
