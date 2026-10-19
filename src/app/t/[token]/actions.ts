"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { swapFilledEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/send";
import { canActAsPerson, resolveSwapToken } from "@/lib/public-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Assumir uma substituição pelo link público.
 *
 * Primeiro que clica leva: a troca é direta e o coordenador só é avisado.
 * A corrida é resolvida no update condicional — só altera o pedido que ainda
 * está `open`, então o segundo clique não sobrescreve o primeiro.
 */
export async function acceptSwapAction(input: {
  token: string;
  personId: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ token: z.string().min(8), personId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return fail("Pedido inválido.");

  const ctx = await resolveSwapToken(parsed.data.token);
  if (!ctx) return fail("Link inválido.");
  if (ctx.swap.status !== "open") {
    return fail(
      ctx.swap.status === "filled"
        ? "Essa vaga já foi assumida."
        : "Esse pedido foi cancelado.",
    );
  }
  if (Date.parse(ctx.event.starts_at) < Date.now()) {
    return fail("Essa celebração já passou.");
  }

  const person = ctx.people.find((p) => p.id === parsed.data.personId);
  if (!person) return fail("Nome não encontrado.");
  if (person.id === ctx.swap.requested_by_person) {
    return fail("Esse é o nome de quem pediu a substituição.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canActAsPerson(person, user?.id ?? null)) {
    return fail("Esse nome está vinculado a uma conta. Entre com ela.");
  }

  const admin = createAdminClient();

  const { data: already } = await admin
    .from("assignments")
    .select("id")
    .eq("event_id", ctx.event.id)
    .eq("person_id", person.id)
    .maybeSingle();
  if (already) return fail("Você já está escalado nesta celebração.");

  // Fecha o pedido primeiro: se dois cliques chegarem juntos, só um encontra
  // o status 'open' e segue adiante.
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
  if (!claimed?.length) return fail("Essa vaga acabou de ser assumida.");

  const { error } = await admin
    .from("assignments")
    .update({ person_id: person.id, status: "confirmed" })
    .eq("id", ctx.assignment.id);
  if (error) {
    // Desfaz para o pedido não ficar "resolvido" sem a troca ter acontecido.
    await admin
      .from("swap_requests")
      .update({ status: "open", filled_by_person: null, filled_at: null })
      .eq("id", ctx.swap.id);
    return fail("Não foi possível assumir a vaga.");
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
  revalidatePath(`/escalas/${ctx.schedule.id}`);
  revalidatePath("/minhas-missas");
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

  const mail = swapFilledEmail({
    personName: requester.full_name,
    filledByName,
    starts_at: ctx.event.starts_at,
    locationName: ctx.location.name,
    timezone: ctx.parish.timezone,
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
