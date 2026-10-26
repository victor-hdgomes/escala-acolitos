"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ERROR_CODES,
  fail,
  ok,
  zodErrorCode,
  type ActionResult,
} from "@/lib/action-result";
import { requireAdmin, requireManager, requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Postgres unique-violation: the row already exists. */
const UNIQUE_VIOLATION = "23505";

// ── Places ──────────────────────────────────────────────────────────────

const locationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, ERROR_CODES.LOCATION_NAME_TOO_SHORT),
  shortName: z.string().trim().max(24).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, ERROR_CODES.INVALID_COLOR),
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
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

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
      error.code === UNIQUE_VIOLATION
        ? ERROR_CODES.LOCATION_DUPLICATE
        : ERROR_CODES.LOCATION_SAVE_FAILED,
    );
  }

  revalidatePath("/group");
  revalidatePath("/home");
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
    // Restricted FK: old celebrations still point at this place.
    return fail(ERROR_CODES.LOCATION_IN_USE);
  }
  revalidatePath("/group");
  revalidatePath("/home");
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
  if (error) return fail(ERROR_CODES.LOCATION_SAVE_FAILED);
  revalidatePath("/group");
  revalidatePath("/home");
  return ok();
}

// ── Weekly pattern ──────────────────────────────────────────────────────

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  locationId: z.string().uuid(ERROR_CODES.TEMPLATE_LOCATION_REQUIRED),
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, ERROR_CODES.TEMPLATE_INVALID_TIME),
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
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

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
      error.code === UNIQUE_VIOLATION
        ? ERROR_CODES.TEMPLATE_DUPLICATE
        : ERROR_CODES.TEMPLATE_SAVE_FAILED,
    );
  }

  revalidatePath("/group");
  revalidatePath("/home");
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
  if (error) return fail(ERROR_CODES.TEMPLATE_DELETE_FAILED);
  revalidatePath("/group");
  revalidatePath("/home");
  return ok();
}

// ── Altar servers ───────────────────────────────────────────────────────

const personSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(2, ERROR_CODES.PERSON_NAME_REQUIRED),
  shortName: z.string().trim().max(60).optional(),
  email: z
    .union([z.string().email(ERROR_CODES.INVALID_EMAIL), z.literal("")])
    .optional(),
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
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

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
      error.code === UNIQUE_VIOLATION
        ? ERROR_CODES.PERSON_DUPLICATE
        : ERROR_CODES.PERSON_SAVE_FAILED,
    );
  }

  revalidatePath("/people");
  revalidatePath("/home");
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
  if (error) return fail(ERROR_CODES.PERSON_SAVE_FAILED);
  revalidatePath("/people");
  revalidatePath("/home");
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
  if (error) return fail(ERROR_CODES.PERSON_DELETE_FAILED);
  revalidatePath("/people");
  revalidatePath("/home");
  return ok();
}

/** One round trip is enough for a whole group; beyond this it is a mistake. */
const MAX_IMPORT_NAMES = 500;

/**
 * Bulk paste - one name per line. That is how the list comes out of the
 * spreadsheet they use today, and typing 54 names one by one is not an option.
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
  if (!names.length) return fail(ERROR_CODES.IMPORT_EMPTY);
  if (names.length > MAX_IMPORT_NAMES) {
    return fail(ERROR_CODES.IMPORT_TOO_MANY, { max: MAX_IMPORT_NAMES });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .upsert(
      names.map((full_name) => ({ parish_id: ctx.parish.id, full_name })),
      { onConflict: "parish_id,full_name", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return fail(ERROR_CODES.IMPORT_FAILED);

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "people.import",
    payload: { count: data?.length ?? 0 },
  });

  revalidatePath("/people");
  revalidatePath("/home");
  return ok({ added: data?.length ?? 0 });
}

/** The signed-in server links their own name to their account. */
export async function claimPersonAction(personId: string): Promise<ActionResult> {
  const ctx = await requireSession();

  const admin = createAdminClient();
  const { data: person } = await admin
    .from("people")
    .select("id, claimed_by, parish_id")
    .eq("id", personId)
    .eq("parish_id", ctx.parish.id)
    .maybeSingle();
  if (!person) return fail(ERROR_CODES.PERSON_NOT_FOUND);
  if (person.claimed_by && person.claimed_by !== ctx.userId) {
    return fail(ERROR_CODES.PERSON_ALREADY_CLAIMED);
  }

  // One account, one name: release the previous link before making the new one.
  await admin
    .from("people")
    .update({ claimed_by: null, claimed_at: null })
    .eq("claimed_by", ctx.userId);

  const { error } = await admin
    .from("people")
    .update({ claimed_by: ctx.userId, claimed_at: new Date().toISOString() })
    .eq("id", personId)
    .is("claimed_by", null);
  if (error) return fail(ERROR_CODES.PERSON_CLAIM_FAILED);

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

/** An admin undoes a link (account lost, wrong name picked). */
export async function unlinkPersonAction(personId: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("people")
    .update({ claimed_by: null, claimed_at: null })
    .eq("id", personId)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail(ERROR_CODES.PERSON_UNLINK_FAILED);

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "person.unlink",
    entity: "people",
    entityId: personId,
  });

  revalidatePath("/people");
  revalidatePath("/home");
  return ok();
}

// ============================================================
// Acting on several altar servers at once
// ============================================================
// A coordinator tidying the list at the end of a year is doing the same thing
// forty times. These take the ids the screen has selected and apply one
// change, with the parish scope on every statement so a selection can never
// reach a row outside the group the caller is in.

const bulkIds = z.array(z.string().uuid()).min(1).max(500);

export async function setPeopleActiveAction(
  ids: string[],
  active: boolean,
): Promise<ActionResult<{ changed: number }>> {
  const ctx = await requireManager();
  const parsed = bulkIds.safeParse(ids);
  if (!parsed.success) return fail(ERROR_CODES.INVALID_REQUEST);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("people")
    .update({ active }, { count: "exact" })
    .eq("parish_id", ctx.parish.id)
    .in("id", parsed.data);
  if (error) return fail(ERROR_CODES.PERSON_SAVE_FAILED);

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: active ? "people.activate" : "people.deactivate",
    entity: "people",
    payload: { count: parsed.data.length },
  });

  revalidatePath("/people");
  revalidatePath("/home");
  return ok({ changed: count ?? parsed.data.length });
}

export async function deletePeopleAction(
  ids: string[],
): Promise<ActionResult<{ changed: number }>> {
  const ctx = await requireAdmin();
  const parsed = bulkIds.safeParse(ids);
  if (!parsed.success) return fail(ERROR_CODES.INVALID_REQUEST);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("people")
    .delete({ count: "exact" })
    .eq("parish_id", ctx.parish.id)
    .in("id", parsed.data);
  if (error) return fail(ERROR_CODES.PERSON_DELETE_FAILED);

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "people.delete.bulk",
    entity: "people",
    payload: { count: parsed.data.length },
  });

  revalidatePath("/people");
  revalidatePath("/home");
  return ok({ changed: count ?? parsed.data.length });
}
