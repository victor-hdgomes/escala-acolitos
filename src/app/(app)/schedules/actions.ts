"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import {
  ERROR_CODES,
  fail,
  ok,
  zodErrorCode,
  type ActionResult,
} from "@/lib/action-result";
import { requireManager, requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { zonedTimeToUtc } from "@/lib/date";
import type { MassTemplate, ScheduleStatus } from "@/lib/db/types";
import { schedulePublishedEmail, swapOpenedEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/send";
import { appUrl } from "@/lib/public-access";
import {
  generateMonthEvents,
  generateNovenaEvents,
} from "@/lib/schedule/generate";
import {
  loadBusyDaysFromOtherSchedules,
  loadPersonStats,
  loadScheduleDetail,
} from "@/lib/schedule/queries";
import { autoFillEvent, rankCandidates } from "@/lib/schedule/suggest";
import { getDateFormatter } from "@/lib/server-date";
import { DEFAULT_TIMEZONE } from "@/lib/timezones";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MONTH_RE = /^\d{4}-\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/**
 * Creates the month's schedule with the weekly pattern already projected into
 * celebrations. The coordinator adjusts it afterwards - generating is only so
 * nobody starts from a blank sheet with 40 rows ahead of them.
 */
export async function createScheduleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireManager();

  const kind = String(formData.get("kind") || "monthly");
  if (kind === "novena") return createNovenaSchedule(ctx, formData);

  const parsed = z
    .object({
      month: z.string().regex(MONTH_RE, ERROR_CODES.SCHEDULE_MONTH_REQUIRED),
      deadline: z.string().optional(),
      generate: z.string().optional(),
    })
    .safeParse({
      month: formData.get("month"),
      deadline: formData.get("deadline") || undefined,
      generate: formData.get("generate") || undefined,
    });
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

  const monthIso = `${parsed.data.month}-01`;
  const supabase = await createClient();
  const [t, df] = await Promise.all([
    getTranslations("schedules"),
    getDateFormatter(ctx.parish.timezone),
  ]);

  const { data: schedule, error } = await supabase
    .from("schedules")
    .insert({
      parish_id: ctx.parish.id,
      title: t("monthlyScheduleTitle", { month: df.monthLabel(monthIso) }),
      month: monthIso,
      kind: "monthly",
      status: "collecting",
      availability_deadline: parsed.data.deadline
        ? deadlineToUtc(parsed.data.deadline, ctx.parish.timezone)
        : null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !schedule) return fail(ERROR_CODES.SCHEDULE_CREATE_FAILED);

  if (parsed.data.generate !== "off") {
    const { data: templates } = await supabase
      .from("mass_templates")
      .select("*")
      .eq("parish_id", ctx.parish.id)
      .eq("active", true);

    const drafts = generateMonthEvents(
      monthIso,
      (templates ?? []) as MassTemplate[],
      ctx.parish.timezone,
    );
    if (drafts.length) {
      await supabase
        .from("events")
        .insert(drafts.map((d) => ({ ...d, schedule_id: schedule.id })));
    }
  }

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "schedule.create",
    entity: "schedules",
    entityId: schedule.id,
    payload: { month: monthIso, kind: "monthly" },
  });

  redirect(`/schedules/${schedule.id}`);
}

/**
 * A schedule for the novena alone, kept apart from the month's.
 *
 * It is born with its days already created and with a link of its own: a
 * devotion with its own dates and slots, which the group treats as a separate
 * thing. The schedule's month comes from the first day - a novena that crosses
 * into the next month stays listed under the month it started in, which is how
 * people refer to it.
 */
async function createNovenaSchedule(
  ctx: Awaited<ReturnType<typeof requireManager>>,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .object({
      title: z.string().trim().min(3, ERROR_CODES.NOVENA_TITLE_REQUIRED),
      locationId: z.string().uuid(ERROR_CODES.EVENT_LOCATION_REQUIRED),
      firstDay: z.string().regex(DAY_RE, ERROR_CODES.EVENT_INVALID_DATE),
      time: z.string().regex(TIME_RE, ERROR_CODES.EVENT_INVALID_TIME),
      days: z.coerce.number().int().min(1).max(31),
      slots: z.coerce.number().int().min(1).max(12),
      signupMode: z.enum(["availability", "direct"]),
      deadline: z.string().optional(),
    })
    .safeParse({
      title: formData.get("title"),
      locationId: formData.get("locationId"),
      firstDay: formData.get("firstDay"),
      time: formData.get("time"),
      days: formData.get("days") || 9,
      slots: formData.get("slots") || 2,
      signupMode: formData.get("signupMode") || "direct",
      deadline: formData.get("deadline") || undefined,
    });
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

  const [h, min] = parsed.data.time.split(":").map(Number);
  const novena = await getTranslations("schedules.novena");
  const drafts = generateNovenaEvents({
    title: parsed.data.title,
    dayLabel: (day) => novena("dayLabel", { day }),
    locationId: parsed.data.locationId,
    firstDay: parsed.data.firstDay,
    hour: h,
    minute: min,
    slots: parsed.data.slots,
    timeZone: ctx.parish.timezone,
    days: parsed.data.days,
  }).map((d) => ({ ...d, signup_mode: parsed.data.signupMode }));

  const monthIso = `${parsed.data.firstDay.slice(0, 7)}-01`;
  const supabase = await createClient();

  const { data: schedule, error } = await supabase
    .from("schedules")
    .insert({
      parish_id: ctx.parish.id,
      title: parsed.data.title,
      month: monthIso,
      kind: "novena",
      status: "collecting",
      availability_deadline: parsed.data.deadline
        ? deadlineToUtc(parsed.data.deadline, ctx.parish.timezone)
        : null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !schedule) return fail(ERROR_CODES.SCHEDULE_CREATE_FAILED);

  const { error: eventsError } = await supabase
    .from("events")
    .insert(drafts.map((d) => ({ ...d, schedule_id: schedule.id })));
  if (eventsError) {
    // A schedule with no days is good for nothing; better not to leave the rest.
    await supabase.from("schedules").delete().eq("id", schedule.id);
    return fail(ERROR_CODES.NOVENA_CREATE_FAILED);
  }

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "schedule.create",
    entity: "schedules",
    entityId: schedule.id,
    payload: { kind: "novena", days: parsed.data.days },
  });

  redirect(`/schedules/${schedule.id}`);
}

/** "2026-10-23" (local date) → the end of that day in the parish's zone. */
function deadlineToUtc(day: string, timeZone: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return zonedTimeToUtc(y, m, d, 23, 59, timeZone).toISOString();
}

export async function updateScheduleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireManager();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const deadline = String(formData.get("deadline") || "");
  const introNote = String(formData.get("introNote") || "").trim();
  if (!id || title.length < 3) return fail(ERROR_CODES.SCHEDULE_TITLE_TOO_SHORT);

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedules")
    .update({
      title,
      intro_note: introNote || null,
      availability_deadline: deadline
        ? deadlineToUtc(deadline, ctx.parish.timezone)
        : null,
    })
    .eq("id", id)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail(ERROR_CODES.SCHEDULE_SAVE_FAILED);

  revalidatePath(`/schedules/${id}`);
  return ok();
}

export async function setScheduleStatusAction(
  scheduleId: string,
  status: ScheduleStatus,
): Promise<ActionResult> {
  const ctx = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedules")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", scheduleId)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail(ERROR_CODES.SCHEDULE_STATUS_FAILED);

  revalidatePath(`/schedules/${scheduleId}`);
  revalidatePath("/schedules");
  return ok();
}

export async function deleteScheduleAction(
  scheduleId: string,
): Promise<ActionResult> {
  const ctx = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail(ERROR_CODES.SCHEDULE_DELETE_FAILED);
  revalidatePath("/schedules");
  return ok();
}

// ── Celebrations ────────────────────────────────────────────────────────

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  scheduleId: z.string().uuid(),
  locationId: z.string().uuid(ERROR_CODES.EVENT_LOCATION_REQUIRED),
  day: z.string().regex(DAY_RE, ERROR_CODES.EVENT_INVALID_DATE),
  time: z.string().regex(TIME_RE, ERROR_CODES.EVENT_INVALID_TIME),
  slots: z.coerce.number().int().min(1).max(12),
  kind: z.enum(["mass", "novena", "special"]),
  signupMode: z.enum(["availability", "direct"]),
  label: z.string().trim().max(160).optional(),
});

export async function saveEventAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireManager();
  const parsed = eventSchema.safeParse({
    id: formData.get("id") || undefined,
    scheduleId: formData.get("scheduleId"),
    locationId: formData.get("locationId"),
    day: formData.get("day"),
    time: formData.get("time"),
    slots: formData.get("slots"),
    kind: formData.get("kind") || "mass",
    signupMode: formData.get("signupMode") || "availability",
    label: formData.get("label") || undefined,
  });
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

  const [y, m, d] = parsed.data.day.split("-").map(Number);
  const [h, min] = parsed.data.time.split(":").map(Number);
  const startsAt = zonedTimeToUtc(y, m, d, h, min, ctx.parish.timezone).toISOString();

  const supabase = await createClient();
  const row = {
    schedule_id: parsed.data.scheduleId,
    location_id: parsed.data.locationId,
    starts_at: startsAt,
    slots: parsed.data.slots,
    kind: parsed.data.kind,
    signup_mode: parsed.data.signupMode,
    label: parsed.data.label ?? null,
  };

  const { error } = parsed.data.id
    ? await supabase.from("events").update(row).eq("id", parsed.data.id)
    : await supabase.from("events").insert(row);

  if (error) {
    return fail(
      error.code === "23505"
        ? ERROR_CODES.EVENT_DUPLICATE
        : ERROR_CODES.EVENT_SAVE_FAILED,
    );
  }

  revalidatePath(`/schedules/${parsed.data.scheduleId}`);
  return ok();
}

export async function deleteEventAction(
  eventId: string,
  scheduleId: string,
): Promise<ActionResult> {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return fail(ERROR_CODES.EVENT_DELETE_FAILED);
  revalidatePath(`/schedules/${scheduleId}`);
  return ok();
}

/** Creates all nine days of a novena at once. */
export async function addNovenaAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireManager();
  const parsed = z
    .object({
      scheduleId: z.string().uuid(),
      title: z.string().trim().min(3, ERROR_CODES.NOVENA_TITLE_REQUIRED),
      locationId: z.string().uuid(ERROR_CODES.EVENT_LOCATION_REQUIRED),
      firstDay: z.string().regex(DAY_RE, ERROR_CODES.EVENT_INVALID_DATE),
      time: z.string().regex(TIME_RE, ERROR_CODES.EVENT_INVALID_TIME),
      slots: z.coerce.number().int().min(1).max(12),
      days: z.coerce.number().int().min(1).max(31),
    })
    .safeParse({
      scheduleId: formData.get("scheduleId"),
      title: formData.get("title"),
      locationId: formData.get("locationId"),
      firstDay: formData.get("firstDay"),
      time: formData.get("time"),
      slots: formData.get("slots") || 2,
      days: formData.get("days") || 9,
    });
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

  const [h, min] = parsed.data.time.split(":").map(Number);
  const novena = await getTranslations("schedules.novena");
  const drafts = generateNovenaEvents({
    title: parsed.data.title,
    dayLabel: (day) => novena("dayLabel", { day }),
    locationId: parsed.data.locationId,
    firstDay: parsed.data.firstDay,
    hour: h,
    minute: min,
    slots: parsed.data.slots,
    timeZone: ctx.parish.timezone,
    days: parsed.data.days,
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .insert(drafts.map((d) => ({ ...d, schedule_id: parsed.data.scheduleId })));
  if (error) {
    return fail(
      error.code === "23505"
        ? ERROR_CODES.NOVENA_DAYS_TAKEN
        : ERROR_CODES.NOVENA_CREATE_FAILED,
    );
  }

  revalidatePath(`/schedules/${parsed.data.scheduleId}`);
  return ok();
}

// ── Assembling ──────────────────────────────────────────────────────────

/** Puts someone in a slot, or takes them out. A null `personId` empties it. */
export async function assignAction({
  eventId,
  position,
  personId,
  scheduleId,
}: {
  eventId: string;
  position: number;
  personId: string | null;
  scheduleId: string;
}): Promise<ActionResult> {
  const ctx = await requireManager();
  const supabase = await createClient();

  if (!personId) {
    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("event_id", eventId)
      .eq("position", position);
    if (error) return fail(ERROR_CODES.UNASSIGN_FAILED);
    revalidatePath(`/schedules/${scheduleId}`);
    return ok();
  }

  // One person does not hold two slots of the same celebration; moving between
  // positions is the common case, so the old link goes first.
  await supabase
    .from("assignments")
    .delete()
    .eq("event_id", eventId)
    .eq("person_id", personId);

  const { error } = await supabase.from("assignments").upsert(
    {
      event_id: eventId,
      person_id: personId,
      position,
      assigned_by: ctx.userId,
      status: "confirmed",
    },
    { onConflict: "event_id,position" },
  );
  if (error) return fail(ERROR_CODES.ASSIGN_FAILED);

  revalidatePath(`/schedules/${scheduleId}`);
  return ok();
}

/** Fills a celebration's empty slots with the best candidates. */
export async function autoFillEventAction(
  eventId: string,
  scheduleId: string,
): Promise<ActionResult<{ filled: number }>> {
  const ctx = await requireManager();
  const admin = createAdminClient();

  const detail = await loadScheduleDetail(admin, scheduleId, {
    withAvailability: true,
  });
  if (!detail) return fail(ERROR_CODES.SCHEDULE_NOT_FOUND);

  const event = detail.days
    .flatMap((d) => d.events)
    .find((e) => e.id === eventId);
  if (!event) return fail(ERROR_CODES.EVENT_NOT_FOUND);

  const { data: peopleRows } = await admin
    .from("people")
    .select("id, full_name, short_name, claimed_by, active")
    .eq("parish_id", ctx.parish.id)
    .eq("active", true);

  const { statsById, byLocation } = await loadPersonStats(
    admin,
    ctx.parish.id,
    scheduleId,
  );
  for (const [personId, perLocation] of byLocation) {
    const s = statsById.get(personId);
    if (s) s.locationCount = perLocation.get(event.location.id) ?? 0;
  }

  const day = detail.days.find((d) => d.events.some((e) => e.id === eventId));
  const sameDayIds = new Set(
    (day?.events ?? [])
      .filter((e) => e.id !== eventId)
      .flatMap((e) => e.slotsView.map((s) => s.person?.id))
      .filter((id): id is string => !!id),
  );

  // Other schedules of the parish may already have the same person on the same
  // day - that is the case of a novena with a schedule of its own.
  const busyByDay = await loadBusyDaysFromOtherSchedules(
    admin,
    ctx.parish.id,
    scheduleId,
    detail.timezone,
    { from: event.starts_at, to: event.starts_at },
  );

  const suggestions = rankCandidates({
    people: (peopleRows ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      short_name: p.short_name,
      claimed_by: p.claimed_by,
      active: p.active,
    })),
    statsById,
    availableIds: new Set(event.availablePeople.map((p) => p.id)),
    sameDayIds,
    otherScheduleDayIds: new Set(day ? (busyByDay[day.key] ?? []) : []),
    eventPersonIds: new Set(
      event.slotsView.map((s) => s.person?.id).filter((id): id is string => !!id),
    ),
  });

  const picks = autoFillEvent({
    suggestions,
    emptyPositions: event.slotsView
      .filter((s) => !s.person)
      .map((s) => s.position),
  });
  if (!picks.length) return ok({ filled: 0 });

  const { error } = await admin.from("assignments").upsert(
    picks.map((p) => ({
      event_id: eventId,
      person_id: p.personId,
      position: p.position,
      assigned_by: ctx.userId,
      status: "confirmed" as const,
    })),
    { onConflict: "event_id,position" },
  );
  if (error) return fail(ERROR_CODES.AUTOFILL_FAILED);

  revalidatePath(`/schedules/${scheduleId}`);
  return ok({ filled: picks.length });
}

/**
 * Publishes the schedule and emails everyone with a linked account.
 * The email is best-effort: a delivery failure does not block publishing.
 */
export async function publishScheduleAction(
  scheduleId: string,
): Promise<ActionResult<{ notified: number }>> {
  const ctx = await requireManager();
  const admin = createAdminClient();

  const detail = await loadScheduleDetail(admin, scheduleId);
  if (!detail || detail.schedule.parish_id !== ctx.parish.id) {
    return fail(ERROR_CODES.SCHEDULE_NOT_FOUND);
  }

  const { error } = await admin
    .from("schedules")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", scheduleId);
  if (error) return fail(ERROR_CODES.SCHEDULE_PUBLISH_FAILED);

  const byPerson = new Map<
    string,
    Array<{ starts_at: string; locationName: string; label: string | null }>
  >();
  for (const day of detail.days) {
    for (const ev of day.events) {
      for (const slot of ev.slotsView) {
        if (!slot.person) continue;
        const list = byPerson.get(slot.person.id) ?? [];
        list.push({
          starts_at: ev.starts_at,
          locationName: ev.location.name,
          label: ev.label,
        });
        byPerson.set(slot.person.id, list);
      }
    }
  }

  const personIds = [...byPerson.keys()];
  const { data: people } = personIds.length
    ? await admin
        .from("people")
        .select("id, full_name, email, claimed_by")
        .in("id", personIds)
    : { data: [] };

  const claimedIds = (people ?? [])
    .map((p) => p.claimed_by)
    .filter((id): id is string => !!id);
  const { data: profiles } = claimedIds.length
    ? await admin.from("profiles").select("id, email").in("id", claimedIds)
    : { data: [] };
  const emailByUser = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  const [mailT, mailDf] = await Promise.all([
    getTranslations("emails"),
    getDateFormatter(detail.timezone),
  ]);
  const url = appUrl(`/v/${detail.schedule.view_token}`);
  let notified = 0;

  for (const person of people ?? []) {
    const to = person.claimed_by
      ? (emailByUser.get(person.claimed_by) ?? person.email)
      : person.email;
    if (!to) continue;

    const mail = schedulePublishedEmail({
      t: mailT,
      df: mailDf,
      personName: person.full_name,
      month: detail.schedule.month,
      masses: byPerson.get(person.id) ?? [],
      url,
    });
    const result = await sendMail({
      to,
      subject: mail.subject,
      html: mail.html,
      dedupeKey: `published:${scheduleId}:${person.id}`,
      kind: "schedule_published",
      parishId: ctx.parish.id,
      personId: person.id,
    });
    if (result === "sent") notified += 1;
  }

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "schedule.publish",
    entity: "schedules",
    entityId: scheduleId,
    payload: { notified },
  });

  revalidatePath(`/schedules/${scheduleId}`);
  revalidatePath("/schedules");
  return ok({ notified });
}

// ── Swaps ───────────────────────────────────────────────────────────────

/**
 * Opens a request for cover. It can start from the altar server themselves (on
 * the "my Masses" screen) or from the coordinator.
 */
export async function requestSwapAction({
  assignmentId,
  reason,
}: {
  assignmentId: string;
  reason?: string;
}): Promise<ActionResult<{ url: string }>> {
  const ctx = await requireSession();
  const admin = createAdminClient();

  const { data: assignment } = await admin
    .from("assignments")
    .select("id, person_id, event_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return fail(ERROR_CODES.SLOT_DOES_NOT_EXIST);

  const { data: event } = await admin
    .from("events")
    .select("id, schedule_id, starts_at, location_id")
    .eq("id", assignment.event_id)
    .maybeSingle();
  if (!event) return fail(ERROR_CODES.EVENT_NOT_FOUND);

  const { data: schedule } = await admin
    .from("schedules")
    .select("parish_id, view_token")
    .eq("id", event.schedule_id)
    .maybeSingle();
  if (!schedule) return fail(ERROR_CODES.SCHEDULE_NOT_FOUND);
  if (schedule.parish_id !== ctx.parish.id) {
    return fail(ERROR_CODES.SCHEDULE_OTHER_GROUP);
  }

  // A plain member only asks for cover on their own slot.
  const isManager = ctx.role !== "member";
  if (!isManager && ctx.person?.id !== assignment.person_id) {
    return fail(ERROR_CODES.SWAP_ONLY_OWN_MASS);
  }

  const { data: existing } = await admin
    .from("swap_requests")
    .select("token")
    .eq("assignment_id", assignmentId)
    .eq("status", "open")
    .maybeSingle();
  if (existing) return ok({ url: appUrl(`/t/${existing.token}`) });

  const { data: swap, error } = await admin
    .from("swap_requests")
    .insert({
      assignment_id: assignmentId,
      requested_by_person: assignment.person_id,
      reason: reason?.trim() || null,
    })
    .select("token")
    .single();
  if (error || !swap) return fail(ERROR_CODES.SWAP_OPEN_FAILED);

  await admin
    .from("assignments")
    .update({ status: "swap_requested" })
    .eq("id", assignmentId);

  await notifyAvailableAboutSwap({
    parishId: ctx.parish.id,
    eventId: assignment.event_id,
    excludePersonId: assignment.person_id,
    swapToken: swap.token,
    startsAt: event.starts_at,
    locationId: event.location_id,
    reason: reason?.trim() || null,
  });

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "swap.open",
    entity: "assignments",
    entityId: assignmentId,
  });

  revalidatePath(`/schedules/${event.schedule_id}`);
  revalidatePath("/my-masses");
  return ok({ url: appUrl(`/t/${swap.token}`) });
}

/**
 * Tells whoever marked themselves available for the celebration - they are the
 * ones most likely to be able to take it, and it avoids throwing the request at
 * the whole group.
 */
async function notifyAvailableAboutSwap({
  parishId,
  eventId,
  excludePersonId,
  swapToken,
  startsAt,
  locationId,
  reason,
}: {
  parishId: string;
  eventId: string;
  excludePersonId: string;
  swapToken: string;
  startsAt: string;
  locationId: string;
  reason: string | null;
}) {
  const admin = createAdminClient();

  const [{ data: parish }, { data: location }, { data: avail }, { data: taken }] =
    await Promise.all([
      admin.from("parishes").select("timezone").eq("id", parishId).single(),
      admin.from("locations").select("name").eq("id", locationId).single(),
      admin.from("availabilities").select("person_id").eq("event_id", eventId),
      admin.from("assignments").select("person_id").eq("event_id", eventId),
    ]);

  const takenIds = new Set((taken ?? []).map((a) => a.person_id));
  const candidateIds = (avail ?? [])
    .map((a) => a.person_id)
    .filter((id) => id !== excludePersonId && !takenIds.has(id));
  if (!candidateIds.length) return;

  const { data: requester } = await admin
    .from("people")
    .select("full_name")
    .eq("id", excludePersonId)
    .single();

  const { data: people } = await admin
    .from("people")
    .select("id, full_name, email, claimed_by")
    .in("id", candidateIds);

  const claimedIds = (people ?? [])
    .map((p) => p.claimed_by)
    .filter((id): id is string => !!id);
  const { data: profiles } = claimedIds.length
    ? await admin.from("profiles").select("id, email").in("id", claimedIds)
    : { data: [] };
  const emailByUser = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  const [t, mailT, mailDf] = await Promise.all([
    getTranslations("schedules"),
    getTranslations("emails"),
    getDateFormatter(parish?.timezone ?? DEFAULT_TIMEZONE),
  ]);
  const url = appUrl(`/t/${swapToken}`);
  for (const person of people ?? []) {
    const to = person.claimed_by
      ? (emailByUser.get(person.claimed_by) ?? person.email)
      : person.email;
    if (!to) continue;

    const mail = swapOpenedEmail({
      t: mailT,
      df: mailDf,
      personName: person.full_name,
      requesterName: requester?.full_name ?? t("notifications.fallbackRequester"),
      starts_at: startsAt,
      locationName: location?.name ?? "",
      url,
      reason,
    });
    await sendMail({
      to,
      subject: mail.subject,
      html: mail.html,
      dedupeKey: `swap:${swapToken}:${person.id}`,
      kind: "swap_opened",
      parishId,
      personId: person.id,
    });
  }
}

export async function cancelSwapAction(swapId: string): Promise<ActionResult> {
  const ctx = await requireSession();
  const admin = createAdminClient();

  const { data: swap } = await admin
    .from("swap_requests")
    .select("id, assignment_id, requested_by_person, status")
    .eq("id", swapId)
    .maybeSingle();
  if (!swap || swap.status !== "open") return fail(ERROR_CODES.SWAP_NOT_OPEN);

  const isManager = ctx.role !== "member";
  if (!isManager && ctx.person?.id !== swap.requested_by_person) {
    return fail(ERROR_CODES.SWAP_ONLY_OWN_REQUEST);
  }

  await admin
    .from("swap_requests")
    .update({ status: "cancelled" })
    .eq("id", swapId);
  await admin
    .from("assignments")
    .update({ status: "confirmed" })
    .eq("id", swap.assignment_id);

  revalidatePath("/my-masses");
  revalidatePath("/schedules");
  return ok();
}
