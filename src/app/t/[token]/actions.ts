"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { ERROR_CODES, fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { swapFilledEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/send";
import { canActAsPerson, resolveSwapToken } from "@/lib/public-access";
import { getDateFormatter } from "@/lib/server-date";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Taking over a cover request through the public link.
 *
 * First click wins: the swap happens straight away and the coordinator is only
 * notified. The race is settled by the conditional update - it only touches a
 * request still marked `open`, so the second click cannot overwrite the first.
 */
export async function acceptSwapAction(input: {
  token: string;
  personId: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ token: z.string().min(8), personId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return fail(ERROR_CODES.INVALID_REQUEST);

  const ctx = await resolveSwapToken(parsed.data.token);
  if (!ctx) return fail(ERROR_CODES.INVALID_LINK);
  if (ctx.swap.status !== "open") {
    return fail(
      ctx.swap.status === "filled"
        ? ERROR_CODES.SWAP_ALREADY_FILLED
        : ERROR_CODES.SWAP_CANCELLED,
    );
  }
  if (Date.parse(ctx.event.starts_at) < Date.now()) {
    return fail(ERROR_CODES.SWAP_IN_THE_PAST);
  }

  const person = ctx.people.find((p) => p.id === parsed.data.personId);
  if (!person) return fail(ERROR_CODES.PERSON_NOT_FOUND);
  if (person.id === ctx.swap.requested_by_person) {
    return fail(ERROR_CODES.SWAP_OWN_REQUEST);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canActAsPerson(person, user?.id ?? null)) {
    return fail(ERROR_CODES.NAME_LOCKED_TO_ACCOUNT);
  }

  const admin = createAdminClient();

  const { data: already } = await admin
    .from("assignments")
    .select("id")
    .eq("event_id", ctx.event.id)
    .eq("person_id", person.id)
    .maybeSingle();
  if (already) return fail(ERROR_CODES.ALREADY_IN_CELEBRATION);

  // Close the request first: if two clicks arrive together, only one of them
  // finds the status 'open' and carries on.
  const { data: claimed } = await admin
    .from("swap_requests")
    .update({
      status: "filled",
      filled_by_person: person.id,
      filled_at: new Date().toISOString(),
    })
    .eq("id", ctx.swap.id)
    .eq("status", "open")
    .select("id");
  if (!claimed?.length) return fail(ERROR_CODES.SLOT_TAKEN);

  const { error } = await admin
    .from("assignments")
    .update({ person_id: person.id, status: "confirmed" })
    .eq("id", ctx.assignment.id);
  if (error) {
    // Roll back, so the request is not left "resolved" without the swap
    // having actually happened.
    await admin
      .from("swap_requests")
      .update({ status: "open", filled_by_person: null, filled_at: null })
      .eq("id", ctx.swap.id);
    return fail(ERROR_CODES.SWAP_ACCEPT_FAILED);
  }

  await notifyRequester(ctx, person.full_name);

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: user?.id ?? null,
    actorLabel: person.full_name,
    action: "swap.accept",
    entity: "swap_requests",
    entityId: ctx.swap.id,
  });

  revalidatePath(`/t/${parsed.data.token}`);
  revalidatePath(`/schedules/${ctx.schedule.id}`);
  revalidatePath("/my-masses");
  return ok();
}

async function notifyRequester(
  ctx: NonNullable<Awaited<ReturnType<typeof resolveSwapToken>>>,
  filledByName: string,
) {
  const admin = createAdminClient();
  const requester = ctx.requester;
  if (!requester) return;

  let to = requester.email;
  if (requester.claimed_by) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", requester.claimed_by)
      .maybeSingle();
    to = profile?.email ?? to;
  }
  if (!to) return;

  const [t, df] = await Promise.all([
    getTranslations("emails"),
    getDateFormatter(ctx.parish.timezone),
  ]);
  const mail = swapFilledEmail({
    t,
    df,
    personName: requester.full_name,
    filledByName,
    starts_at: ctx.event.starts_at,
    locationName: ctx.location.name,
  });
  await sendMail({
    to,
    subject: mail.subject,
    html: mail.html,
    dedupeKey: `swapfilled:${ctx.swap.id}`,
    kind: "swap_filled",
    parishId: ctx.parish.id,
    personId: requester.id,
  });
}
