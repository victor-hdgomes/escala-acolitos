"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ERROR_CODES,
  fail,
  ok,
  type ActionResult,
  type ErrorCode,
} from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { canActAsPerson, resolveFillToken } from "@/lib/public-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Public link actions.
 *
 * Nothing here trusts an id coming from the client: the token resolves the
 * schedule, and only then are event_id and person_id checked against it.
 * Without that, anyone holding a valid link could write to any schedule in the
 * database.
 */

const MAX_BATCH = 200;

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Tells the reader which of the two reasons closed the schedule. */
function closedCode(reason: "deadline" | "status" | null): ErrorCode {
  return reason === "deadline"
    ? ERROR_CODES.FILL_CLOSED_DEADLINE
    : ERROR_CODES.FILL_CLOSED_STATUS;
}

/** Marks or unmarks availability - one celebration, or the filtered batch. */
export async function setAvailabilityAction(input: {
  token: string;
  personId: string;
  eventIds: string[];
  value: boolean;
}): Promise<ActionResult<{ changed: number }>> {
  const parsed = z
    .object({
      token: z.string().min(8),
      personId: z.string().uuid(),
      eventIds: z.array(z.string().uuid()).min(1).max(MAX_BATCH),
      value: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return fail(ERROR_CODES.INVALID_REQUEST);

  const ctx = await resolveFillToken(parsed.data.token);
  if (!ctx) return fail(ERROR_CODES.INVALID_LINK);
  if (!ctx.open) return fail(closedCode(ctx.closedReason));

  const person = ctx.people.find((p) => p.id === parsed.data.personId);
  if (!person) return fail(ERROR_CODES.PERSON_NOT_FOUND);

  const userId = await currentUserId();
  if (!canActAsPerson(person, userId)) {
    return fail(ERROR_CODES.NAME_LOCKED_TO_ACCOUNT);
  }

  // Only celebrations from this schedule, and only those collecting availability.
  const allowed = new Set(
    ctx.detail.days
      .flatMap((d) => d.events)
      .filter((e) => e.signup_mode === "availability")
      .map((e) => e.id),
  );
  const eventIds = parsed.data.eventIds.filter((id) => allowed.has(id));
  if (!eventIds.length) return fail(ERROR_CODES.NO_VALID_CELEBRATION);

  const admin = createAdminClient();
  if (parsed.data.value) {
    const { error } = await admin.from("availabilities").upsert(
      eventIds.map((event_id) => ({
        event_id,
        person_id: person.id,
        source: userId ? ("account" as const) : ("public" as const),
      })),
      { onConflict: "event_id,person_id", ignoreDuplicates: true },
    );
    if (error) return fail(ERROR_CODES.AVAILABILITY_SAVE_FAILED);
  } else {
    const { error } = await admin
      .from("availabilities")
      .delete()
      .eq("person_id", person.id)
      .in("event_id", eventIds);
    if (error) return fail(ERROR_CODES.AVAILABILITY_SAVE_FAILED);
  }

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: userId,
    actorLabel: person.full_name,
    action: parsed.data.value ? "availability.add" : "availability.remove",
    entity: "schedules",
    entityId: ctx.schedule.id,
    payload: { count: eventIds.length },
  });

  revalidatePath(`/e/${parsed.data.token}`);
  return ok({ changed: eventIds.length });
}

/**
 * Novena and the like: the person takes the slot straight away, without going
 * through the coordinator. A race between two simultaneous taps is settled by
 * the unique index on (event_id, position) - the second one gets 23505 and is
 * told the slot has just been taken.
 */
export async function claimDirectSlotAction(input: {
  token: string;
  personId: string;
  eventId: string;
  position: number;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      token: z.string().min(8),
      personId: z.string().uuid(),
      eventId: z.string().uuid(),
      position: z.number().int().min(1).max(12),
    })
    .safeParse(input);
  if (!parsed.success) return fail(ERROR_CODES.INVALID_REQUEST);

  const ctx = await resolveFillToken(parsed.data.token);
  if (!ctx) return fail(ERROR_CODES.INVALID_LINK);
  if (!ctx.open) return fail(closedCode(ctx.closedReason));

  const person = ctx.people.find((p) => p.id === parsed.data.personId);
  if (!person) return fail(ERROR_CODES.PERSON_NOT_FOUND);

  const userId = await currentUserId();
  if (!canActAsPerson(person, userId)) {
    return fail(ERROR_CODES.NAME_LOCKED_TO_ACCOUNT);
  }

  const event = ctx.detail.days
    .flatMap((d) => d.events)
    .find((e) => e.id === parsed.data.eventId);
  if (!event) return fail(ERROR_CODES.EVENT_NOT_FOUND);
  if (event.signup_mode !== "direct") {
    return fail(ERROR_CODES.COORDINATOR_ASSIGNS_THIS);
  }
  if (parsed.data.position > event.slots) {
    return fail(ERROR_CODES.SLOT_DOES_NOT_EXIST);
  }
  if (event.slotsView.some((s) => s.person?.id === person.id)) {
    return fail(ERROR_CODES.ALREADY_IN_CELEBRATION);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("assignments").insert({
    event_id: event.id,
    person_id: person.id,
    position: parsed.data.position,
    status: "confirmed",
  });
  if (error) {
    return fail(
      error.code === "23505"
        ? ERROR_CODES.SLOT_TAKEN
        : ERROR_CODES.CLAIM_SLOT_FAILED,
    );
  }

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: userId,
    actorLabel: person.full_name,
    action: "direct.claim",
    entity: "events",
    entityId: event.id,
    payload: { position: parsed.data.position },
  });

  revalidatePath(`/e/${parsed.data.token}`);
  return ok();
}

/** Releases your own slot on a direct-signup celebration. */
export async function releaseDirectSlotAction(input: {
  token: string;
  personId: string;
  eventId: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      token: z.string().min(8),
      personId: z.string().uuid(),
      eventId: z.string().uuid(),
    })
    .safeParse(input);
  if (!parsed.success) return fail(ERROR_CODES.INVALID_REQUEST);

  const ctx = await resolveFillToken(parsed.data.token);
  if (!ctx) return fail(ERROR_CODES.INVALID_LINK);
  if (!ctx.open) return fail(closedCode(ctx.closedReason));

  const person = ctx.people.find((p) => p.id === parsed.data.personId);
  if (!person) return fail(ERROR_CODES.PERSON_NOT_FOUND);

  const userId = await currentUserId();
  if (!canActAsPerson(person, userId)) {
    return fail(ERROR_CODES.NAME_LOCKED_TO_ACCOUNT);
  }

  const event = ctx.detail.days
    .flatMap((d) => d.events)
    .find((e) => e.id === parsed.data.eventId);
  if (!event || event.signup_mode !== "direct") {
    return fail(ERROR_CODES.EVENT_NOT_FOUND);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("assignments")
    .delete()
    .eq("event_id", event.id)
    .eq("person_id", person.id);
  if (error) return fail(ERROR_CODES.RELEASE_SLOT_FAILED);

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: userId,
    actorLabel: person.full_name,
    action: "direct.release",
    entity: "events",
    entityId: event.id,
  });

  revalidatePath(`/e/${parsed.data.token}`);
  return ok();
}
