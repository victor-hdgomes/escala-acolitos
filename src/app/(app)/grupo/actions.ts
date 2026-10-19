"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireAdmin, requireManager, requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// ── Locais ──────────────────────────────────────────────────────────────

const locationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Dê um nome ao local."),
  shortName: z.string().trim().max(24).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function saveLocationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = locationSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    shortName: formData.get("shortName") || undefined,
    color: formData.get("color") || "#6366f1",
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const row = {
    parish_id: ctx.parish.id,
    name: parsed.data.name,
    short_name: parsed.data.shortName ?? null,
    color: parsed.data.color,
    sort_order: parsed.data.sortOrder,
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("locations")
        .update(row)
        .eq("id", parsed.data.id)
        .eq("parish_id", ctx.parish.id)
    : await supabase.from("locations").insert(row);

  if (error) {
    return fail(
      error.code === "23505"
        ? "Já existe um local com esse nome."
        : "Não foi possível salvar o local.",
    );
  }

  revalidatePath("/grupo");
  return ok();
}

export async function deleteLocationAction(id: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", id)
    .eq("parish_id", ctx.parish.id);
  if (error) {
    // FK restrita: há celebrações antigas apontando para o local.
    return fail(
      "Este local já aparece em alguma escala. Desative-o em vez de excluir.",
    );
  }
  revalidatePath("/grupo");
  return ok();
}

export async function toggleLocationAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({ active })
    .eq("id", id)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail("Não foi possível alterar.");
  revalidatePath("/grupo");
  return ok();
}

// ── Grade semanal ───────────────────────────────────────────────────────

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  locationId: z.string().uuid("Escolha o local."),
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido."),
  slots: z.coerce.number().int().min(1).max(12),
  label: z.string().trim().max(120).optional(),
});

export async function saveTemplateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = templateSchema.safeParse({
    id: formData.get("id") || undefined,
    locationId: formData.get("locationId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    slots: formData.get("slots"),
    label: formData.get("label") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const row = {
    parish_id: ctx.parish.id,
    location_id: parsed.data.locationId,
    weekday: parsed.data.weekday,
    start_time: `${parsed.data.startTime}:00`,
    slots: parsed.data.slots,
    label: parsed.data.label ?? null,
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("mass_templates")
        .update(row)
        .eq("id", parsed.data.id)
        .eq("parish_id", ctx.parish.id)
    : await supabase.from("mass_templates").insert(row);

  if (error) {
    return fail(
      error.code === "23505"
        ? "Já existe essa missa na grade."
        : "Não foi possível salvar.",
    );
  }

  revalidatePath("/grupo");
  return ok();
}

export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("mass_templates")
    .delete()
    .eq("id", id)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath("/grupo");
  return ok();
}

// ── Acólitos ────────────────────────────────────────────────────────────

const personSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(2, "Diga o nome completo."),
  shortName: z.string().trim().max(60).optional(),
  email: z.union([z.string().email("E-mail inválido."), z.literal("")]).optional(),
  phone: z.string().trim().max(32).optional(),
});

export async function savePersonAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireManager();
  const parsed = personSchema.safeParse({
    id: formData.get("id") || undefined,
    fullName: formData.get("fullName"),
    shortName: formData.get("shortName") || undefined,
    email: formData.get("email") ?? "",
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const row = {
    parish_id: ctx.parish.id,
    full_name: parsed.data.fullName,
    short_name: parsed.data.shortName ?? null,
    email: parsed.data.email ? parsed.data.email : null,
    phone: parsed.data.phone ?? null,
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("people")
        .update(row)
        .eq("id", parsed.data.id)
        .eq("parish_id", ctx.parish.id)
    : await supabase.from("people").insert(row);

  if (error) {
    return fail(
      error.code === "23505"
        ? "Já existe alguém com esse nome no grupo."
        : "Não foi possível salvar.",
    );
  }

  revalidatePath("/pessoas");
  return ok();
}

export async function togglePersonActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const ctx = await requireManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({ active })
    .eq("id", id)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail("Não foi possível alterar.");
  revalidatePath("/pessoas");
  return ok();
}

export async function deletePersonAction(id: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .delete()
    .eq("id", id)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath("/pessoas");
  return ok();
}

/**
 * Colagem em massa — um nome por linha. É assim que a lista sai da planilha
 * atual, e digitar 54 nomes um a um não é opção.
 */
export async function importPeopleAction(
  _prev: ActionResult<{ added: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ added: number }>> {
  const ctx = await requireManager();
  const raw = String(formData.get("names") || "");
  const names = [
    ...new Set(
      raw
        .split(/[\n;,]/)
        .map((n) => n.trim().replace(/\s+/g, " "))
        .filter((n) => n.length >= 2),
    ),
  ];
  if (!names.length) return fail("Cole ao menos um nome.");
  if (names.length > 500) return fail("Até 500 nomes por vez.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .upsert(
      names.map((full_name) => ({ parish_id: ctx.parish.id, full_name })),
      { onConflict: "parish_id,full_name", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return fail("Não foi possível importar.");

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "people.import",
    payload: { count: data?.length ?? 0 },
  });

  revalidatePath("/pessoas");
  return ok({ added: data?.length ?? 0 });
}

/** O próprio acólito logado vincula o seu nome. */
export async function claimPersonAction(personId: string): Promise<ActionResult> {
  const ctx = await requireSession();

  const admin = createAdminClient();
  const { data: person } = await admin
    .from("people")
    .select("id, claimed_by, parish_id")
    .eq("id", personId)
    .eq("parish_id", ctx.parish.id)
    .maybeSingle();
  if (!person) return fail("Nome não encontrado neste grupo.");
  if (person.claimed_by && person.claimed_by !== ctx.userId) {
    return fail("Esse nome já está vinculado a outra conta.");
  }

  // Uma conta, um nome: solta o vínculo anterior antes de criar o novo.
  await admin
    .from("people")
    .update({ claimed_by: null, claimed_at: null })
    .eq("claimed_by", ctx.userId);

  const { error } = await admin
    .from("people")
    .update({ claimed_by: ctx.userId, claimed_at: new Date().toISOString() })
    .eq("id", personId)
    .is("claimed_by", null);
  if (error) return fail("Não foi possível vincular.");

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "person.claim",
    entity: "people",
    entityId: personId,
  });

  revalidatePath("/", "layout");
  return ok();
}

/** Admin desfaz um vínculo (conta perdida, nome trocado). */
export async function unlinkPersonAction(personId: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("people")
    .update({ claimed_by: null, claimed_at: null })
    .eq("id", personId)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail("Não foi possível desvincular.");

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "person.unlink",
    entity: "people",
    entityId: personId,
  });

  revalidatePath("/pessoas");
  return ok();
}
