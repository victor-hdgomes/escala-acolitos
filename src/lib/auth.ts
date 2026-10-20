import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Parish, Person, Role } from "@/lib/db/types";

export const VIEW_AS_COOKIE = "escala-view-as";
export const ACTIVE_PARISH_COOKIE = "escala-grupo";

const ROLE_RANK: Record<Role, number> = { member: 0, coordinator: 1, admin: 2 };

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  coordinator: "Coordenador",
  member: "Acólito",
};

export interface ParishMembership {
  parish: Parish;
  role: Role;
}

export interface SessionContext {
  userId: string;
  email: string | null;
  displayName: string;
  /** Dono da instalação: enxerga e administra todos os grupos. */
  isSuperadmin: boolean;
  /** Grupo em uso nesta navegação. */
  parish: Parish;
  /** Todos os grupos a que esta conta pertence — alimenta o seletor. */
  memberships: ParishMembership[];
  /** Papel real no grupo ativo. */
  role: Role;
  /** Papel em uso: admin pode rebaixar o seu para conferir as outras telas. */
  effectiveRole: Role;
  /** Acólito vinculado a esta conta neste grupo, quando existe. */
  person: Person | null;
}

/**
 * Contexto da sessão. Null quando não há usuário logado ou quando a conta
 * ainda não pertence a nenhum grupo (o app manda para `/grupos/novo`).
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
    displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "Você",
    isSuperadmin,
    parish: active.parish,
    memberships,
    role: active.role,
    effectiveRole: await resolveViewAs(active.role),
    person: (person as Person) ?? null,
  };
}

/**
 * Grupos da conta. O superadmin vê todos — e é por isso que esta leitura
 * usa a service role: sem membership, a policy de `parishes` o esconderia.
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
 * "Ver como": o admin troca a própria visão sem trocar de conta. Só rebaixa —
 * ninguém ganha permissão por cookie.
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
  // Logado, mas sem grupo: o caminho é criar um ou aceitar um convite.
  if (!ctx) redirect("/grupos/novo");
  return ctx;
}

/** Coordenador ou admin. Usa o papel real: "ver como" não bloqueia ação. */
export async function requireManager(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.role === "member") redirect("/inicio");
  return ctx;
}

export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.role !== "admin") redirect("/inicio");
  return ctx;
}

export function canManage(ctx: SessionContext): boolean {
  return ctx.role === "admin" || ctx.role === "coordinator";
}

/**
 * Dono da instalação. Consultado pelo id porque as ações que dependem disto
 * rodam antes de haver contexto de grupo — criar o primeiro grupo, por
 * exemplo. Lê com service role: a policy de `profiles` só deixa cada um ler
 * a própria linha, o que aqui basta, mas o id vem do servidor de qualquer forma.
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
