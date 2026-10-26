import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { dayKey } from "@/lib/date";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { reminderEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/send";
import { appUrl } from "@/lib/public-access";
import { getDateFormatterFor } from "@/lib/server-date";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Constant time, so the comparison does not leak the secret one byte at a
 * time through how long it takes to fail.
 */
function matchesSecret(header: string | null, secret: string): boolean {
  const got = Buffer.from(header ?? "", "utf8");
  const want = Buffer.from(`Bearer ${secret}`, "utf8");
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * A reminder of tomorrow's Masses. Meant for Vercel Cron to run once a day in
 * the morning.
 *
 * "Tomorrow" is worked out in each group's own zone - a group in Manaus and one
 * in Goiânia do not turn the day at the same moment. The `email_log` makes sure
 * running twice does not send two e-mails.
 *
 * There is no reader behind this request, so neither the language nor the clock
 * can be inferred: the recipient's locale is stated, and the date formatter is
 * built for the parish being processed.
 */
export async function GET(request: NextRequest) {
  // Fails closed. With no secret configured this used to answer anybody, and
  // it reads every parish with the service role, so an unauthenticated caller
  // could mail the whole installation at will.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  }
  if (!matchesSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: parishes } = await admin.from("parishes").select("*");

  // Until a per-person language preference exists, everyone is written to in
  // the source language.
  const locale = DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "emails" });

  let sent = 0;

  for (const parish of parishes ?? []) {
    const df = getDateFormatterFor(locale, parish.timezone);
    const tomorrow = dayKey(
      new Date(Date.now() + 86_400_000),
      parish.timezone,
    );

    const { data: schedules } = await admin
      .from("schedules")
      .select("id, view_token")
      .eq("parish_id", parish.id)
      .eq("status", "published");
    if (!schedules?.length) continue;

    const { data: events } = await admin
      .from("events")
      .select("id, starts_at, location_id, label, schedule_id")
      .in(
        "schedule_id",
        schedules.map((s) => s.id),
      );

    const tomorrowEvents = (events ?? []).filter(
      (e) => dayKey(e.starts_at, parish.timezone) === tomorrow,
    );
    if (!tomorrowEvents.length) continue;

    const [{ data: assignments }, { data: locations }] = await Promise.all([
      admin
        .from("assignments")
        .select("person_id, event_id")
        .in(
          "event_id",
          tomorrowEvents.map((e) => e.id),
        ),
      admin.from("locations").select("id, name").eq("parish_id", parish.id),
    ]);
    if (!assignments?.length) continue;

    const locationName = new Map((locations ?? []).map((l) => [l.id, l.name]));
    const eventById = new Map(tomorrowEvents.map((e) => [e.id, e]));
    const tokenBySchedule = new Map(schedules.map((s) => [s.id, s.view_token]));

    const byPerson = new Map<
      string,
      { masses: Array<{ starts_at: string; locationName: string; label: string | null }>; token: string }
    >();
    for (const a of assignments) {
      const event = eventById.get(a.event_id);
      if (!event) continue;
      const entry = byPerson.get(a.person_id) ?? {
        masses: [],
        token: tokenBySchedule.get(event.schedule_id) ?? "",
      };
      entry.masses.push({
        starts_at: event.starts_at,
        locationName: locationName.get(event.location_id) ?? "-",
        label: event.label,
      });
      byPerson.set(a.person_id, entry);
    }

    const { data: people } = await admin
      .from("people")
      .select("id, full_name, email, claimed_by")
      .in("id", [...byPerson.keys()]);

    const claimedIds = (people ?? [])
      .map((p) => p.claimed_by)
      .filter((id): id is string => !!id);
    const { data: profiles } = claimedIds.length
      ? await admin.from("profiles").select("id, email").in("id", claimedIds)
      : { data: [] };
    const emailByUser = new Map((profiles ?? []).map((p) => [p.id, p.email]));

    for (const person of people ?? []) {
      const entry = byPerson.get(person.id);
      if (!entry) continue;
      const to = person.claimed_by
        ? (emailByUser.get(person.claimed_by) ?? person.email)
        : person.email;
      if (!to) continue;

      const mail = reminderEmail({
        t,
        df,
        personName: person.full_name,
        masses: entry.masses,
        url: appUrl(`/v/${entry.token}`),
      });
      const result = await sendMail({
        to,
        subject: mail.subject,
        html: mail.html,
        dedupeKey: `reminder:${tomorrow}:${person.id}`,
        kind: "reminder",
        parishId: parish.id,
        personId: person.id,
      });
      if (result === "sent") sent += 1;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
