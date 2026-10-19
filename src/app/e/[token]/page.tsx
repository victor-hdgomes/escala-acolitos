import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FillView } from "@/components/organisms/fill/fill-view";
import type { FillDay, FillEvent } from "@/components/organisms/fill/fill-view";
import {
  dayKey,
  formatDayMonth,
  formatFullDate,
  formatTime,
  periodOf,
  weekdayLong,
  zonedParts,
} from "@/lib/date";
import { resolveFillToken } from "@/lib/public-access";
import { nowDate, nowMs } from "@/lib/now";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Preencher escala",
  robots: { index: false, follow: false },
};

export default async function FillPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await resolveFillToken(token);
  if (!ctx) notFound();

  const { timezone } = ctx.detail;
  const now = nowMs();

  const events: FillEvent[] = [];
  const days: FillDay[] = [];

  for (const day of ctx.detail.days) {
    const ids: string[] = [];
    for (const ev of day.events) {
      ids.push(ev.id);
      events.push({
        id: ev.id,
        dayKey: day.key,
        timeLabel: formatTime(ev.starts_at, timezone),
        weekday: zonedParts(ev.starts_at, timezone).weekday,
        period: periodOf(ev.starts_at, timezone),
        locationId: ev.location.id,
        locationName: ev.location.name,
        locationShort: ev.location.short_name ?? ev.location.name,
        locationColor: ev.location.color,
        label: ev.label,
        kind: ev.kind,
        signupMode: ev.signup_mode,
        slots: ev.slots,
        takenNames: ev.slotsView.map((s) =>
          s.person ? (s.person.short_name ?? s.person.full_name) : null,
        ),
        takenIds: ev.slotsView.map((s) => s.person?.id ?? null),
        availableCount: ev.availablePeople.length,
        isPast: Date.parse(ev.starts_at) < now,
      });
    }
    const first = day.events[0];
    days.push({
      key: day.key,
      title: formatDayMonth(first.starts_at, timezone),
      weekdayLabel: weekdayLong(first.starts_at, timezone),
      eventIds: ids,
    });
  }

  // Disponibilidades já marcadas, por pessoa: o formulário reabre no estado
  // em que ficou, inclusive em outro aparelho.
  const admin = createAdminClient();
  const eventIds = events.map((e) => e.id);
  const { data: availabilities } = eventIds.length
    ? await admin
        .from("availabilities")
        .select("event_id, person_id")
        .in("event_id", eventIds)
    : { data: [] };

  const byPerson: Record<string, string[]> = {};
  for (const row of availabilities ?? []) {
    (byPerson[row.person_id] ??= []).push(row.event_id);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myPersonId = user
    ? (ctx.people.find((p) => p.claimed_by === user.id)?.id ?? null)
    : null;

  const locations = [
    ...new Map(
      events.map((e) => [
        e.locationId,
        { id: e.locationId, name: e.locationName, color: e.locationColor },
      ]),
    ).values(),
  ];

  return (
    <FillView
      token={token}
      parishName={ctx.parish.name}
      title={ctx.schedule.title}
      introNote={ctx.schedule.intro_note}
      deadlineLabel={
        ctx.schedule.availability_deadline
          ? formatFullDate(ctx.schedule.availability_deadline, timezone)
          : null
      }
      open={ctx.open}
      closedReason={ctx.closedReason}
      days={days}
      events={events}
      locations={locations}
      people={ctx.people
        .filter((p) => p.active)
        .map((p) => ({
          id: p.id,
          name: p.full_name,
          claimed: !!p.claimed_by,
          isMe: p.id === myPersonId,
        }))}
      availabilityByPerson={byPerson}
      todayKey={dayKey(nowDate(), timezone)}
    />
  );
}
