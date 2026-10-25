import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FillGate } from "@/components/organisms/fill/fill-gate";
import { FillView } from "@/components/organisms/fill/fill-view";
import type { FillDay, FillEvent } from "@/components/organisms/fill/fill-view";
import { dayKey, periodOf, zonedParts } from "@/lib/date";
import { nowDate, nowMs } from "@/lib/now";
import { resolveFillToken } from "@/lib/public-access";
import { getDateFormatter } from "@/lib/server-date";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("fill");
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

/**
 * Whether this account may answer a members-only schedule, and, when it may
 * not, the code it should hand to whoever coordinates the group.
 */
async function membersOnlyGate(
  parishId: string,
  userId: string | null,
): Promise<{ blocked: boolean; joinCode: string | null }> {
  if (!userId) return { blocked: true, joinCode: null };

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("memberships")
    .select("id")
    .eq("parish_id", parishId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membership) return { blocked: false, joinCode: null };

  const { data: profile } = await admin
    .from("profiles")
    .select("join_code")
    .eq("id", userId)
    .maybeSingle();
  return { blocked: true, joinCode: profile?.join_code ?? null };
}

export default async function FillPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await resolveFillToken(token);
  if (!ctx) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A group may decide that only its own accounts answer. The check runs
  // before anything is loaded: whoever cannot answer should not be handed the
  // list of names either.
  if (ctx.parish.fill_access === "members") {
    const gate = await membersOnlyGate(ctx.parish.id, user?.id ?? null);
    if (gate.blocked) {
      return (
        <FillGate
          parishName={ctx.parish.name}
          token={token}
          joinCode={gate.joinCode}
        />
      );
    }
  }

  const { timezone } = ctx.detail;
  const df = await getDateFormatter(timezone);
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
        timeLabel: df.time(ev.starts_at),
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
      title: df.dayMonth(first.starts_at),
      weekdayLabel: df.weekday(first.starts_at),
      eventIds: ids,
    });
  }

  // Availability already marked, by person: the form reopens in the state it
  // was left in, even on another device.
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
          ? df.fullDate(ctx.schedule.availability_deadline)
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
