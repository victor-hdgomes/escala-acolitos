"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { ERROR_CODES, fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { swapOpenedEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/send";
import { appUrl, canActAsPerson, resolveViewToken } from "@/lib/public-access";
import { getDateFormatter } from "@/lib/server-date";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Asking for cover straight from the published schedule - no sign-in.
 *
 * It is the first thing that hurts once the schedule is out: "can anyone cover
 * for me tomorrow at 10?". Requiring an account here would push the request
 * back into the WhatsApp group.
 */
export async function requestSwapPublicAction(input: {
  token: string;
  assignmentId: string;
  reason?: string;
}): Promise<ActionResult<{ url: string }>> {
  const parsed = z
    .object({
      token: z.string().min(8),
      assignmentId: z.string().uuid(),
      reason: z.string().trim().max(280).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail(ERROR_CODES.INVALID_REQUEST);

  const ctx = await resolveViewToken(parsed.data.token);
  if (!ctx) return fail(ERROR_CODES.INVALID_LINK);

  const event = ctx.detail.days
    .flatMap((d) => d.events)
    .find((e) => e.slotsView.some((s) => s.assignmentId === parsed.data.assignmentId));
  const slot = event?.slotsView.find(
    (s) => s.assignmentId === parsed.data.assignmentId,
  );
  if (!event || !slot?.person) return fail(ERROR_CODES.SLOT_DOES_NOT_EXIST);
  if (Date.parse(event.starts_at) < Date.now()) {
    return fail(ERROR_CODES.SWAP_IN_THE_PAST);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canActAsPerson(slot.person, user?.id ?? null)) {
    return fail(ERROR_CODES.NAME_LOCKED_TO_ACCOUNT);
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("swap_requests")
    .select("token")
    .eq("assignment_id", parsed.data.assignmentId)
    .eq("status", "open")
    .maybeSingle();
  if (existing) return ok({ url: appUrl(`/t/${existing.token}`) });

  const { data: swap, error } = await admin
    .from("swap_requests")
    .insert({
      assignment_id: parsed.data.assignmentId,
      requested_by_person: slot.person.id,
      reason: parsed.data.reason || null,
    })
    .select("token")
    .single();
  if (error || !swap) return fail(ERROR_CODES.SWAP_OPEN_FAILED);

  await admin
    .from("assignments")
    .update({ status: "swap_requested" })
    .eq("id", parsed.data.assignmentId);

  await notifyCandidates({
    parishId: ctx.parish.id,
    timezone: ctx.detail.timezone,
    eventId: event.id,
    locationName: event.location.name,
    startsAt: event.starts_at,
    requesterId: slot.person.id,
    requesterName: slot.person.full_name,
    swapToken: swap.token,
    reason: parsed.data.reason || null,
  });

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: user?.id ?? null,
    actorLabel: slot.person.full_name,
    action: "swap.open.public",
    entity: "assignments",
    entityId: parsed.data.assignmentId,
  });

  revalidatePath(`/v/${parsed.data.token}`);
  return ok({ url: appUrl(`/t/${swap.token}`) });
}

/** Emails everyone who marked availability for that celebration. */
async function notifyCandidates({
  parishId,
  timezone,
  eventId,
  locationName,
  startsAt,
  requesterId,
  requesterName,
  swapToken,
  reason,
}: {
  parishId: string;
  timezone: string;
  eventId: string;
  locationName: string;
  startsAt: string;
  requesterId: string;
  requesterName: string;
  swapToken: string;
  reason: string | null;
}) {
  const admin = createAdminClient();
  const [{ data: avail }, { data: taken }] = await Promise.all([
    admin.from("availabilities").select("person_id").eq("event_id", eventId),
    admin.from("assignments").select("person_id").eq("event_id", eventId),
  ]);

  const takenIds = new Set((taken ?? []).map((a) => a.person_id));
  const ids = (avail ?? [])
    .map((a) => a.person_id)
    .filter((id) => id !== requesterId && !takenIds.has(id));
  if (!ids.length) return;

  const { data: people } = await admin
    .from("people")
    .select("id, full_name, email, claimed_by")
    .in("id", ids);

  const claimedIds = (people ?? [])
    .map((p) => p.claimed_by)
    .filter((id): id is string => !!id);
  const { data: profiles } = claimedIds.length
    ? await admin.from("profiles").select("id, email").in("id", claimedIds)
    : { data: [] };
  const emailByUser = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  const [t, df] = await Promise.all([
    getTranslations("emails"),
    getDateFormatter(timezone),
  ]);
  const url = appUrl(`/t/${swapToken}`);
  for (const person of people ?? []) {
    const to = person.claimed_by
      ? (emailByUser.get(person.claimed_by) ?? person.email)
      : person.email;
    if (!to) continue;

    const mail = swapOpenedEmail({
      t,
      df,
      personName: person.full_name,
      requesterName,
      starts_at: startsAt,
      locationName,
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
