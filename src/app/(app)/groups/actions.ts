"use server";

import { cookies } from "next/headers";
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
import {
  ACTIVE_PARISH_COOKIE,
  canCreateParish,
  getSessionContext,
  requireAdmin,
  requireSession,
  VIEW_AS_COOKIE,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Role } from "@/lib/db/types";
import { normalizeJoinCode } from "@/lib/join-code";
import { inviteEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/send";
import { appUrl, resolveJoinLink } from "@/lib/public-access";
import { getDateFormatter } from "@/lib/server-date";
import { slugify, uniqueSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE } from "@/lib/timezones";

const ROLES = ["admin", "coordinator", "member"] as const;

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/**
 * The two fields a group is made of. Shared by creation and editing so the
 * same name rule applies to both; each caller supplies its own time-zone
 * fallback, since a new group defaults and an existing one keeps what it has.
 */
const parishSchema = z.object({
  name: z.string().trim().min(3, ERROR_CODES.GROUP_NAME_TOO_SHORT),
  timezone: z.string().trim().min(1).optional(),
  fillAccess: z.enum(["open", "members"]).optional(),
});

/**
 * Creates a group and makes whoever created it its administrator.
 *
 * Uses the service role because the membership does not exist yet at insert
 * time - the `memberships` policy demands being an admin of the group, and
 * nobody is an admin of a group that has only just been born.
 */
export async function createParishAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(ERROR_CODES.NOT_AUTHENTICATED);

  // Creation runs with the service role (the group and its admin membership
  // have to be born together), so RLS guards nothing here - this is the check.
  //
  // An account with no group creates the first one: this is the app's front
  // door, and someone who arrives alone has to be able to register their own
  // parish. An account that already belongs to a group does not open others -
  // that is what stops an invited server from spawning parishes.
  if (!(await canCreateParish(user.id))) {
    return fail(ERROR_CODES.ALREADY_IN_A_GROUP);
  }

  const parsed = parishSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone") || undefined,
  });
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

  const admin = createAdminClient();
  const { data: existing } = await admin.from("parishes").select("slug");
  const slug = uniqueSlug(
    slugify(parsed.data.name),
    new Set((existing ?? []).map((p) => p.slug)),
  );

  const { data: parish, error } = await admin
    .from("parishes")
    .insert({
      name: parsed.data.name,
      slug,
      timezone: parsed.data.timezone ?? DEFAULT_TIMEZONE,
    })
    .select("id")
    .single();
  if (error || !parish) return fail(ERROR_CODES.GROUP_CREATE_FAILED);

  const { error: memberError } = await admin.from("memberships").insert({
    parish_id: parish.id,
    user_id: user.id,
    role: "admin",
  });
  if (memberError) {
    // Without an admin the group is unreachable: better that it not exist.
    await admin.from("parishes").delete().eq("id", parish.id);
    return fail(ERROR_CODES.GROUP_CREATE_FAILED);
  }

  await logAudit({
    parishId: parish.id,
    actorUserId: user.id,
    action: "parish.create",
    entity: "parishes",
    entityId: parish.id,
    payload: { name: parsed.data.name },
  });

  const jar = await cookies();
  jar.set(ACTIVE_PARISH_COOKIE, parish.id, COOKIE_OPTS);
  redirect("/group");
}

/** Switches the active group. Only accepts a group the account belongs to. */
export async function switchParishAction(parishId: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return fail(ERROR_CODES.SESSION_EXPIRED);
  if (!ctx.memberships.some((m) => m.parish.id === parishId)) {
    return fail(ERROR_CODES.NOT_A_MEMBER);
  }

  const jar = await cookies();
  jar.set(ACTIVE_PARISH_COOKIE, parishId, COOKIE_OPTS);
  revalidatePath("/", "layout");
  return ok();
}

export async function updateParishAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = parishSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone") || undefined,
    fillAccess: formData.get("fillAccess") || undefined,
  });
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

  const supabase = await createClient();
  const { error } = await supabase
    .from("parishes")
    .update({
      name: parsed.data.name,
      timezone: parsed.data.timezone ?? ctx.parish.timezone,
      fill_access: parsed.data.fillAccess ?? ctx.parish.fill_access,
    })
    .eq("id", ctx.parish.id);
  if (error) return fail(ERROR_CODES.GROUP_SAVE_FAILED);

  revalidatePath("/group");
  return ok();
}

/** Invitation by link - and by email too, when an address is given. */
export async function createInviteAction(
  _prev: ActionResult<{ url: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const ctx = await requireAdmin();

  const role = String(formData.get("role") || "member") as Role;
  if (!ROLES.includes(role)) return fail(ERROR_CODES.INVALID_ROLE);

  const email = String(formData.get("email") || "").trim() || null;
  const personId = String(formData.get("personId") || "").trim() || null;

  const admin = createAdminClient();
  if (personId) {
    const { data: person } = await admin
      .from("people")
      .select("id")
      .eq("id", personId)
      .eq("parish_id", ctx.parish.id)
      .maybeSingle();
    if (!person) return fail(ERROR_CODES.PERSON_NOT_FOUND);
  }

  const { data: invite, error } = await admin
    .from("invites")
    .insert({
      parish_id: ctx.parish.id,
      email,
      role,
      person_id: personId,
      created_by: ctx.userId,
    })
    .select("token")
    .single();
  if (error || !invite) return fail(ERROR_CODES.INVITE_CREATE_FAILED);

  const url = appUrl(`/invite/${invite.token}`);

  if (email) {
    // The role name is copy, so it comes from the catalog rather than from a
    // constant - in the admin's language, which is the best guess available
    // before the recipient has ever opened the app.
    const [roles, t, df] = await Promise.all([
      getTranslations("group.roles"),
      getTranslations("emails"),
      getDateFormatter(ctx.parish.timezone),
    ]);
    const mail = inviteEmail({
      t,
      df,
      parishName: ctx.parish.name,
      roleLabel: roles(role),
      url,
    });
    await sendMail({
      to: email,
      subject: mail.subject,
      html: mail.html,
      dedupeKey: `invite:${invite.token}`,
      kind: "invite",
      parishId: ctx.parish.id,
    });
  }

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "invite.create",
    entity: "invites",
    payload: { role, email },
  });

  revalidatePath("/group");
  return ok({ url });
}

export async function revokeInviteAction(inviteId: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invites")
    .delete()
    .eq("id", inviteId)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail(ERROR_CODES.INVITE_REVOKE_FAILED);
  revalidatePath("/group");
  return ok();
}

/**
 * Accepts an invitation. Runs with the service role: whoever accepts is not a
 * member yet, so no policy would let them read the invite or create their own
 * membership.
 */
export async function acceptInviteAction(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(ERROR_CODES.NOT_AUTHENTICATED);

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!invite) return fail(ERROR_CODES.INVITE_NOT_FOUND);
  if (invite.accepted_at) return fail(ERROR_CODES.INVITE_ALREADY_USED);
  if (Date.parse(invite.expires_at) < Date.now()) {
    return fail(ERROR_CODES.INVITE_EXPIRED);
  }

  const { error } = await admin.from("memberships").upsert(
    { parish_id: invite.parish_id, user_id: user.id, role: invite.role },
    { onConflict: "parish_id,user_id" },
  );
  if (error) return fail(ERROR_CODES.JOIN_FAILED);

  // A named invite settles the name link right here - unless someone beat
  // this account to it.
  if (invite.person_id) {
    await admin
      .from("people")
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("id", invite.person_id)
      .is("claimed_by", null);
  }

  await admin
    .from("invites")
    .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  await logAudit({
    parishId: invite.parish_id,
    actorUserId: user.id,
    action: "invite.accept",
    entity: "invites",
    entityId: invite.id,
  });

  const jar = await cookies();
  jar.set(ACTIVE_PARISH_COOKIE, invite.parish_id, COOKIE_OPTS);
  revalidatePath("/", "layout");
  return ok();
}

/**
 * Is this the group's only administrator?
 *
 * Asked before any change that could cost someone their admin rights: with no
 * admin left, nobody can edit the group any more - not even to undo it.
 */
async function isLastAdmin(parishId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const [{ count }, { data: current }] = await Promise.all([
    admin
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("parish_id", parishId)
      .eq("role", "admin"),
    admin
      .from("memberships")
      .select("role")
      .eq("parish_id", parishId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  return current?.role === "admin" && (count ?? 0) <= 1;
}

/** Promotes or demotes someone. */
export async function changeMemberRoleAction(
  userId: string,
  role: Role,
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!ROLES.includes(role)) return fail(ERROR_CODES.INVALID_ROLE);

  if (role !== "admin" && (await isLastAdmin(ctx.parish.id, userId))) {
    return fail(ERROR_CODES.LAST_ADMIN);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .update({ role })
    .eq("parish_id", ctx.parish.id)
    .eq("user_id", userId);
  if (error) return fail(ERROR_CODES.ROLE_CHANGE_FAILED);

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "membership.role",
    entity: "memberships",
    payload: { userId, role },
  });

  revalidatePath("/group");
  return ok();
}

export async function removeMemberAction(userId: string): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (await isLastAdmin(ctx.parish.id, userId)) {
    return fail(ERROR_CODES.LAST_ADMIN);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .delete()
    .eq("parish_id", ctx.parish.id)
    .eq("user_id", userId);
  if (error) return fail(ERROR_CODES.MEMBER_REMOVE_FAILED);

  // The account leaves the group, but the server stays on the list - an old
  // schedule still has to show who served.
  await admin
    .from("people")
    .update({ claimed_by: null, claimed_at: null })
    .eq("parish_id", ctx.parish.id)
    .eq("claimed_by", userId);

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "membership.remove",
    entity: "memberships",
    payload: { userId },
  });

  revalidatePath("/group");
  return ok();
}

/** An admin switches their own view to check the other screens. */
export async function setViewAsAction(role: Role | null): Promise<ActionResult> {
  await requireSession();
  const jar = await cookies();
  if (!role) jar.delete(VIEW_AS_COOKIE);
  else jar.set(VIEW_AS_COOKIE, role, { ...COOKIE_OPTS, httpOnly: false });
  revalidatePath("/", "layout");
  return ok();
}

// ============================================================
// Joining a group
// ============================================================

export interface FoundAccount {
  userId: string;
  displayName: string;
  email: string | null;
  /** Already in this group: the screen offers nothing more to do. */
  alreadyMember: boolean;
  /** A name in this group this account has already claimed, if any. */
  personId: string | null;
}

/**
 * Finds the account behind a join code or an exact e-mail address.
 *
 * Deliberately not a search: it matches the whole code or the whole address,
 * so a coordinator can only reach an account whose owner handed them the
 * details. Nothing here lists accounts or completes a partial address, and
 * the lookup needs the service role, because a coordinator can read no
 * profiles row but their own.
 */
export async function findAccountAction(
  query: string,
): Promise<ActionResult<FoundAccount>> {
  const ctx = await requireAdmin();
  const trimmed = query.trim();
  if (!trimmed) return fail(ERROR_CODES.JOIN_CODE_REQUIRED);

  const admin = createAdminClient();
  const isEmail = trimmed.includes("@");
  const { data: profile } = isEmail
    ? await admin
        .from("profiles")
        .select("id, display_name, email")
        .ilike("email", trimmed)
        .maybeSingle()
    : await admin
        .from("profiles")
        .select("id, display_name, email")
        .eq("join_code", normalizeJoinCode(trimmed))
        .maybeSingle();
  if (!profile) return fail(ERROR_CODES.ACCOUNT_NOT_FOUND);

  const [{ data: membership }, { data: person }] = await Promise.all([
    admin
      .from("memberships")
      .select("id")
      .eq("parish_id", ctx.parish.id)
      .eq("user_id", profile.id)
      .maybeSingle(),
    admin
      .from("people")
      .select("id")
      .eq("parish_id", ctx.parish.id)
      .eq("claimed_by", profile.id)
      .maybeSingle(),
  ]);

  return ok({
    userId: profile.id,
    displayName:
      profile.display_name ?? profile.email?.split("@")[0] ?? trimmed,
    email: profile.email,
    alreadyMember: !!membership,
    personId: person?.id ?? null,
  });
}

/**
 * Adds a found account to the group, optionally tying it to a name on the
 * altar servers list.
 *
 * The same account can belong to several groups: the membership is per group,
 * so an altar server who serves at two chapels joins both and switches
 * between them in the app.
 */
export async function addAccountToGroupAction(input: {
  userId: string;
  role: Role;
  /** An existing name on the list to link the account to. */
  personId?: string | null;
  /** Or a new name to create and link, when they are not on the list yet. */
  personName?: string | null;
}): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!ROLES.includes(input.role)) return fail(ERROR_CODES.INVALID_ROLE);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", input.userId)
    .maybeSingle();
  if (!profile) return fail(ERROR_CODES.ACCOUNT_NOT_FOUND);

  const { error } = await admin.from("memberships").upsert(
    { parish_id: ctx.parish.id, user_id: input.userId, role: input.role },
    { onConflict: "parish_id,user_id" },
  );
  if (error) return fail(ERROR_CODES.JOIN_FAILED);

  if (input.personId) {
    // Only an unclaimed name is taken: whoever got there first keeps it.
    await admin
      .from("people")
      .update({ claimed_by: input.userId, claimed_at: new Date().toISOString() })
      .eq("id", input.personId)
      .eq("parish_id", ctx.parish.id)
      .is("claimed_by", null);
  } else if (input.personName?.trim()) {
    await admin.from("people").insert({
      parish_id: ctx.parish.id,
      full_name: input.personName.trim(),
      claimed_by: input.userId,
      claimed_at: new Date().toISOString(),
    });
  }

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "membership.add",
    entity: "memberships",
    payload: { userId: input.userId, role: input.role },
  });

  revalidatePath("/group");
  revalidatePath("/people");
  return ok();
}

// ------------------------------------------------------------- join links

const joinLinkSchema = z.object({
  role: z.enum(["admin", "coordinator", "member"]),
  label: z.string().trim().max(60).optional(),
  maxUses: z.coerce.number().int().min(1).max(500).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export async function createJoinLinkAction(
  _prev: ActionResult<{ url: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const ctx = await requireAdmin();
  const parsed = joinLinkSchema.safeParse({
    role: formData.get("role") || "member",
    label: formData.get("label") || undefined,
    maxUses: formData.get("maxUses") || undefined,
    expiresInDays: formData.get("expiresInDays") || undefined,
  });
  if (!parsed.success) return fail(ERROR_CODES.INVALID_ROLE);

  const admin = createAdminClient();
  const { data: link, error } = await admin
    .from("join_links")
    .insert({
      parish_id: ctx.parish.id,
      role: parsed.data.role,
      label: parsed.data.label ?? null,
      max_uses: parsed.data.maxUses ?? null,
      expires_at: parsed.data.expiresInDays
        ? new Date(
            Date.now() + parsed.data.expiresInDays * 86_400_000,
          ).toISOString()
        : null,
      created_by: ctx.userId,
    })
    .select("token")
    .single();
  if (error || !link) return fail(ERROR_CODES.JOIN_LINK_CREATE_FAILED);

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "joinLink.create",
    entity: "join_links",
    payload: { role: parsed.data.role },
  });

  revalidatePath("/group");
  return ok({ url: appUrl(`/j/${link.token}`) });
}

export async function setJoinLinkActiveAction(
  linkId: string,
  active: boolean,
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("join_links")
    .update({ active })
    .eq("id", linkId)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail(ERROR_CODES.JOIN_LINK_SAVE_FAILED);
  revalidatePath("/group");
  return ok();
}

export async function deleteJoinLinkAction(
  linkId: string,
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("join_links")
    .delete()
    .eq("id", linkId)
    .eq("parish_id", ctx.parish.id);
  if (error) return fail(ERROR_CODES.JOIN_LINK_SAVE_FAILED);
  revalidatePath("/group");
  return ok();
}

const CLOSED_REASON_CODE = {
  inactive: ERROR_CODES.JOIN_LINK_INACTIVE,
  expired: ERROR_CODES.JOIN_LINK_EXPIRED,
  exhausted: ERROR_CODES.JOIN_LINK_EXHAUSTED,
} as const;

/**
 * Spends a join link for the signed-in account.
 *
 * Runs with the service role for the same reason accepting an invite does:
 * whoever is redeeming is not in the group yet, so no policy would let them
 * read the link or create their own membership.
 */
export async function redeemJoinLinkAction(
  token: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(ERROR_CODES.NOT_AUTHENTICATED);

  const context = await resolveJoinLink(token);
  if (!context) return fail(ERROR_CODES.JOIN_LINK_NOT_FOUND);
  if (context.closedReason) {
    return fail(CLOSED_REASON_CODE[context.closedReason]);
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("memberships")
    .select("id")
    .eq("parish_id", context.link.parish_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await admin.from("memberships").insert({
      parish_id: context.link.parish_id,
      user_id: user.id,
      role: context.link.role,
    });
    if (error) return fail(ERROR_CODES.JOIN_FAILED);

    // Counted only on a real join, so reopening the link does not burn a seat.
    // The read-then-write is not atomic; at the scale of a parish group the
    // worst case is one extra seat on a capped link, which beats an RPC.
    await admin
      .from("join_links")
      .update({ uses: context.link.uses + 1 })
      .eq("id", context.link.id);

    await logAudit({
      parishId: context.link.parish_id,
      actorUserId: user.id,
      action: "joinLink.redeem",
      entity: "join_links",
      entityId: context.link.id,
    });
  }

  const jar = await cookies();
  jar.set(ACTIVE_PARISH_COOKIE, context.link.parish_id, COOKIE_OPTS);
  revalidatePath("/", "layout");
  return ok();
}
