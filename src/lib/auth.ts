import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Parish, Person, Role } from "@/lib/db/types";

export const VIEW_AS_COOKIE = "altar-view-as";
export const ACTIVE_PARISH_COOKIE = "altar-active-group";

export type { Role };

/**
 * Every role, from the most to the least authority.
 *
 * Replaces the old `ROLE_LABEL` map, whose keys callers used as the list of
 * roles while its values were hardcoded Portuguese. The label now lives in the
 * catalog under `common.roles.<role>`, so the data and the copy stop travelling
 * together.
 */
export const ROLES = ["admin", "coordinator", "member"] as const satisfies readonly Role[];

const ROLE_RANK: Record<Role, number> = { member: 0, coordinator: 1, admin: 2 };

export interface ParishMembership {
  parish: Parish;
  role: Role;
}

export interface SessionContext {
  userId: string;
  email: string | null;
  displayName: string;
  /** Owner of the installation: sees and administers every group. */
  isSuperadmin: boolean;
  /** Group in use for this navigation. */
  parish: Parish;
  /** Every group this account belongs to - feeds the picker. */
  memberships: ParishMembership[];
  /** Real role in the active group. */
  role: Role;
  /** Role in use: an admin can demote their own to check the other screens. */
  effectiveRole: Role;
  /** Altar server linked to this account in this group, when there is one. */
  person: Person | null;
}

/**
 * Session context. Null when nobody is signed in, or when the account does not
 * belong to any group yet (the app sends it to `/groups/new`).
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_superadmin")
    .eq("id", user.id)
    .maybeSingle();
  const isSuperadmin = profile?.is_superadmin ?? false;

  const memberships = await loadMemberships(user.id, isSuperadmin);
  if (memberships.length === 0) return null;

  const jar = await cookies();
  const wanted = jar.get(ACTIVE_PARISH_COOKIE)?.value;
  const active =
    memberships.find((m) => m.parish.id === wanted) ?? memberships[0];

  const { data: person } = await supabase
    .from("people")
    .select("*")
    .eq("claimed_by", user.id)
    .eq("parish_id", active.parish.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    // The last fallback is translated rather than hardcoded, and is only
    // reached by an account with no profile name and no email at all.
    displayName:
      profile?.display_name ??
      user.email?.split("@")[0] ??
      (await getTranslations("common"))("you"),
    isSuperadmin,
    parish: active.parish,
    memberships,
    role: active.role,
    effectiveRole: await resolveViewAs(active.role),
    person: (person as Person) ?? null,
  };
}

/**
 * The account's groups. The superadmin sees them all - which is why this read
 * uses the service role: with no membership, the `parishes` policy would hide
 * them.
 */
async function loadMemberships(
  userId: string,
  isSuperadmin: boolean,
): Promise<ParishMembership[]> {
  if (isSuperadmin) {
    const admin = createAdminClient();
    const [{ data: parishes }, { data: rows }] = await Promise.all([
      admin.from("parishes").select("*").order("name", { ascending: true }),
      admin.from("memberships").select("parish_id, role").eq("user_id", userId),
    ]);
    const roleByParish = new Map((rows ?? []).map((r) => [r.parish_id, r.role]));
    return ((parishes ?? []) as Parish[]).map((parish) => ({
      parish,
      role: (roleByParish.get(parish.id) as Role) ?? "admin",
    }));
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("memberships")
    .select("role, parish_id")
    .eq("user_id", userId);
  if (!rows?.length) return [];

  const { data: parishes } = await supabase
    .from("parishes")
    .select("*")
    .in(
      "id",
      rows.map((r) => r.parish_id),
    )
    .order("name", { ascending: true });

  const roleByParish = new Map(rows.map((r) => [r.parish_id, r.role as Role]));
  return ((parishes ?? []) as Parish[]).map((parish) => ({
    parish,
    role: roleByParish.get(parish.id) ?? "member",
  }));
}

/**
 * "View as": an admin changes their own view without changing account. It only
 * ever demotes - nobody gains permission through a cookie.
 */
async function resolveViewAs(role: Role): Promise<Role> {
  const jar = await cookies();
  const raw = jar.get(VIEW_AS_COOKIE)?.value as Role | undefined;
  if (!raw || !(raw in ROLE_RANK)) return role;
  return ROLE_RANK[raw] < ROLE_RANK[role] ? raw : role;
}

export async function requireSession(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getSessionContext();
  // Signed in, but in no group. Most accounts that land here are altar
  // servers waiting to be added, not organisers, so the way forward is the
  // waiting screen and not the "open a group" form.
  if (!ctx) redirect("/pending");
  return ctx;
}

/** Coordinator or admin. Uses the real role: "view as" never blocks an action. */
export async function requireManager(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.role === "member") redirect("/home");
  return ctx;
}

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.role !== "admin") redirect("/home");
  return ctx;
}

export function canManage(ctx: SessionContext): boolean {
  return ctx.role === "admin" || ctx.role === "coordinator";
}

/**
 * Owner of the installation. Looked up by id because the actions that depend on
 * this run before there is any group context - creating the first group, for
 * one. Reads with the service role: the `profiles` policy only lets each person
 * read their own row, which is enough here, but the id comes from the server
 * either way.
 */
export async function isSuperadmin(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("is_superadmin")
    .eq("id", userId)
    .maybeSingle();
  return data?.is_superadmin ?? false;
}

/**
 * Who may open a parish.
 *
 * An account with no group at all creates the first one - that is the app's
 * front door, and without it nobody gets in on their own. Someone who already
 * belongs to a group does not open more, which is what keeps an invited altar
 * server away from creation. A superadmin always creates.
 */
export async function canCreateParish(userId: string): Promise<boolean> {
  if (await isSuperadmin(userId)) return true;

  const admin = createAdminClient();
  const { count } = await admin
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) === 0;
}
