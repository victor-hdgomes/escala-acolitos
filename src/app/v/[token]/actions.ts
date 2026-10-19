"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { swapOpenedEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/send";
import { appUrl, canActAsPerson, resolveViewToken } from "@/lib/public-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Pedido de substituição a partir da escala publicada — sem login.
 *
 * É a primeira dor depois da escala pronta: "alguém me substitui amanhã às
 * 10h?". Exigir conta aqui jogaria o pedido de volta para o grupo do WhatsApp.
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
  if (!parsed.success) return fail("Pedido inválido.");

  const ctx = await resolveViewToken(parsed.data.token);
  if (!ctx) return fail("Link inválido.");

  const event = ctx.detail.days
    .flatMap((d) => d.events)
    .find((e) => e.slotsView.some((s) => s.assignmentId === parsed.data.assignmentId));
  const slot = event?.slotsView.find(
    (s) => s.assignmentId === parsed.data.assignmentId,
  );
  if (!event || !slot?.person) return fail("Escalação não encontrada.");
  if (Date.parse(event.starts_at) < Date.now()) {
    return fail("Essa celebração já passou.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canActAsPerson(slot.person, user?.id ?? null)) {
    return fail("Esse nome está vinculado a uma conta. Entre com ela.");
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
  if (error || !swap) return fail("Não foi possível abrir o pedido.");

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

/** Avisa por e-mail quem marcou disponibilidade para aquela celebração. */
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

  const url = appUrl(`/t/${swapToken}`);
  for (const person of people ?? []) {
    const to = person.claimed_by
      ? (emailByUser.get(person.claimed_by) ?? person.email)
      : person.email;
    if (!to) continue;

    const mail = swapOpenedEmail({
      personName: person.full_name,
      requesterName,
      starts_at: startsAt,
      locationName,
      timezone,
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
