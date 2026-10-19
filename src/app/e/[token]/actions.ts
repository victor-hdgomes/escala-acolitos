"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { canActAsPerson, resolveFillToken } from "@/lib/public-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Ações do link público.
 *
 * Nada aqui confia num id vindo do cliente: o token resolve a escala, e só
 * então event_id e person_id são conferidos contra ela. Sem isso, qualquer um
 * com um link válido escreveria em qualquer escala do banco.
 */

const MAX_BATCH = 200;

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Marca ou desmarca disponibilidade — uma celebração ou o lote dos filtros. */
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
  if (!parsed.success) return fail("Pedido inválido.");

  const ctx = await resolveFillToken(parsed.data.token);
  if (!ctx) return fail("Link inválido.");
  if (!ctx.open) {
    return fail(
      ctx.closedReason === "deadline"
        ? "O prazo de preenchimento terminou."
        : "Esta escala não está aberta para preenchimento.",
    );
  }

  const person = ctx.people.find((p) => p.id === parsed.data.personId);
  if (!person) return fail("Nome não encontrado nesta escala.");

  const userId = await currentUserId();
  if (!canActAsPerson(person, userId)) {
    return fail(
      "Esse nome está vinculado a uma conta. Entre com ela para marcar.",
    );
  }

  // Só celebrações desta escala, e só as que coletam disponibilidade.
  const allowed = new Set(
    ctx.detail.days
      .flatMap((d) => d.events)
      .filter((e) => e.signup_mode === "availability")
      .map((e) => e.id),
  );
  const eventIds = parsed.data.eventIds.filter((id) => allowed.has(id));
  if (!eventIds.length) return fail("Nenhuma celebração válida.");

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
    if (error) return fail("Não foi possível salvar.");
  } else {
    const { error } = await admin
      .from("availabilities")
      .delete()
      .eq("person_id", person.id)
      .in("event_id", eventIds);
    if (error) return fail("Não foi possível salvar.");
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
 * Novena e afins: a pessoa pega a vaga direto, sem passar pelo coordenador.
 * A corrida entre dois cliques simultâneos é resolvida pelo índice único
 * (event_id, position) — o segundo recebe 23505 e vê "já foi preenchida".
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
  if (!parsed.success) return fail("Pedido inválido.");

  const ctx = await resolveFillToken(parsed.data.token);
  if (!ctx) return fail("Link inválido.");
  if (!ctx.open) return fail("Esta escala não está aberta.");

  const person = ctx.people.find((p) => p.id === parsed.data.personId);
  if (!person) return fail("Nome não encontrado.");

  const userId = await currentUserId();
  if (!canActAsPerson(person, userId)) {
    return fail("Esse nome está vinculado a uma conta. Entre com ela.");
  }

  const event = ctx.detail.days
    .flatMap((d) => d.events)
    .find((e) => e.id === parsed.data.eventId);
  if (!event) return fail("Celebração não encontrada.");
  if (event.signup_mode !== "direct") {
    return fail("Esta celebração é preenchida pelo coordenador.");
  }
  if (parsed.data.position > event.slots) return fail("Vaga inexistente.");
  if (event.slotsView.some((s) => s.person?.id === person.id)) {
    return fail("Você já está nesta celebração.");
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
        ? "Essa vaga acabou de ser preenchida."
        : "Não foi possível pegar a vaga.",
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

/** Libera a própria vaga de uma celebração de preenchimento direto. */
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
  if (!parsed.success) return fail("Pedido inválido.");

  const ctx = await resolveFillToken(parsed.data.token);
  if (!ctx) return fail("Link inválido.");
  if (!ctx.open) return fail("Esta escala não está aberta.");

  const person = ctx.people.find((p) => p.id === parsed.data.personId);
  if (!person) return fail("Nome não encontrado.");

  const userId = await currentUserId();
  if (!canActAsPerson(person, userId)) {
    return fail("Esse nome está vinculado a uma conta. Entre com ela.");
  }

  const event = ctx.detail.days
    .flatMap((d) => d.events)
    .find((e) => e.id === parsed.data.eventId);
  if (!event || event.signup_mode !== "direct") {
    return fail("Celebração não encontrada.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("assignments")
    .delete()
    .eq("event_id", event.id)
    .eq("person_id", person.id);
  if (error) return fail("Não foi possível liberar a vaga.");

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
