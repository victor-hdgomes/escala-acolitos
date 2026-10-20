"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  ACTIVE_PARISH_COOKIE,
  getSessionContext,
  isSuperadmin,
  requireAdmin,
  requireSession,
  ROLE_LABEL,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Role } from "@/lib/db/types";
import { inviteEmail } from "@/lib/mail/templates";
import { sendMail } from "@/lib/mail/send";
import { appUrl } from "@/lib/public-access";
import { slugify, uniqueSlug } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["admin", "coordinator", "member"] as const;

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/**
 * Cria um grupo e torna quem criou administrador dele.
 *
 * Usa service role porque o membership ainda não existe no momento do insert —
 * a policy de `memberships` exige ser admin do grupo, e ninguém é admin de um
 * grupo que acabou de nascer.
 */
export async function createParishAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Faça login primeiro.");

  // A criação roda com service role (o grupo e o membership de admin precisam
  // nascer juntos), então o RLS não protege nada aqui — esta é a checagem.
  if (!(await isSuperadmin(user.id))) {
    return fail(
      "Só o administrador da instalação cria grupos. Peça um link de convite.",
    );
  }

  const parsed = z
    .object({
      name: z.string().trim().min(3, "Dê um nome ao grupo."),
      timezone: z.string().trim().min(1).default("America/Sao_Paulo"),
    })
    .safeParse({
      name: formData.get("name"),
      timezone: formData.get("timezone") || "America/Sao_Paulo",
    });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

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
      timezone: parsed.data.timezone,
    })
    .select("id")
    .single();
  if (error || !parish) return fail("Não foi possível criar o grupo.");

  const { error: memberError } = await admin.from("memberships").insert({
    parish_id: parish.id,
    user_id: user.id,
    role: "admin",
  });
  if (memberError) {
    // Sem admin o grupo fica inacessível: melhor não existir.
    await admin.from("parishes").delete().eq("id", parish.id);
    return fail("Não foi possível criar o grupo.");
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
  redirect("/grupo");
}

/** Troca o grupo ativo. Só aceita grupo a que a conta pertence. */
export async function switchParishAction(parishId: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return fail("Sessão expirada.");
  if (!ctx.memberships.some((m) => m.parish.id === parishId)) {
    return fail("Você não participa desse grupo.");
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
  const name = String(formData.get("name") || "").trim();
  const timezone = String(formData.get("timezone") || "").trim();
  if (name.length < 3) return fail("Dê um nome ao grupo.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("parishes")
    .update({ name, timezone: timezone || ctx.parish.timezone })
    .eq("id", ctx.parish.id);
  if (error) return fail("Não foi possível salvar.");

  revalidatePath("/grupo");
  return ok();
}

/** Convite por link (e por e-mail, quando o endereço é informado). */
export async function createInviteAction(
  _prev: ActionResult<{ url: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const ctx = await requireAdmin();

  const role = String(formData.get("role") || "member") as Role;
  if (!ROLES.includes(role)) return fail("Papel inválido.");

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
    if (!person) return fail("Acólito não encontrado neste grupo.");
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
  if (error || !invite) return fail("Não foi possível criar o convite.");

  const url = appUrl(`/convite/${invite.token}`);

  if (email) {
    const mail = inviteEmail({
      parishName: ctx.parish.name,
      roleLabel: ROLE_LABEL[role],
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

  revalidatePath("/grupo");
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
  if (error) return fail("Não foi possível revogar.");
  revalidatePath("/grupo");
  return ok();
}

/**
 * Aceita um convite. Roda com service role: quem aceita ainda não é membro,
 * então nenhuma policy o deixaria ler o convite ou criar o próprio membership.
 */
export async function acceptInviteAction(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Faça login para aceitar o convite.");

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!invite) return fail("Convite não encontrado.");
  if (invite.accepted_at) return fail("Este convite já foi usado.");
  if (Date.parse(invite.expires_at) < Date.now()) return fail("Convite expirado.");

  const { error } = await admin.from("memberships").upsert(
    { parish_id: invite.parish_id, user_id: user.id, role: invite.role },
    { onConflict: "parish_id,user_id" },
  );
  if (error) return fail("Não foi possível entrar no grupo.");

  // Convite nominal já resolve o vínculo do nome — só se ninguém pegou antes.
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

/** Promove ou rebaixa alguém. */
export async function changeMemberRoleAction(
  userId: string,
  role: Role,
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (!ROLES.includes(role)) return fail("Papel inválido.");

  const admin = createAdminClient();
  if (role !== "admin") {
    const { count } = await admin
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("parish_id", ctx.parish.id)
      .eq("role", "admin");
    const { data: current } = await admin
      .from("memberships")
      .select("role")
      .eq("parish_id", ctx.parish.id)
      .eq("user_id", userId)
      .maybeSingle();
    // Sem admin, ninguém mais edita o grupo — nem para desfazer isto.
    if (current?.role === "admin" && (count ?? 0) <= 1) {
      return fail("O grupo precisa de pelo menos um administrador.");
    }
  }

  const { error } = await admin
    .from("memberships")
    .update({ role })
    .eq("parish_id", ctx.parish.id)
    .eq("user_id", userId);
  if (error) return fail("Não foi possível alterar o papel.");

  await logAudit({
    parishId: ctx.parish.id,
    actorUserId: ctx.userId,
    action: "membership.role",
    entity: "memberships",
    payload: { userId, role },
  });

  revalidatePath("/grupo");
  return ok();
}

export async function removeMemberAction(userId: string): Promise<ActionResult> {
  const ctx = await requireAdmin();

  const admin = createAdminClient();
  const { count } = await admin
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("parish_id", ctx.parish.id)
    .eq("role", "admin");
  const { data: current } = await admin
    .from("memberships")
    .select("role")
    .eq("parish_id", ctx.parish.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (current?.role === "admin" && (count ?? 0) <= 1) {
    return fail("O grupo precisa de pelo menos um administrador.");
  }

  const { error } = await admin
    .from("memberships")
    .delete()
    .eq("parish_id", ctx.parish.id)
    .eq("user_id", userId);
  if (error) return fail("Não foi possível remover.");

  // A conta sai do grupo, mas o acólito continua na lista — a escala antiga
  // precisa continuar mostrando quem serviu.
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

  revalidatePath("/grupo");
  return ok();
}

/** Admin alterna a própria visão para conferir as outras telas. */
export async function setViewAsAction(role: Role | null): Promise<ActionResult> {
  await requireSession();
  const jar = await cookies();
  if (!role) jar.delete("escala-view-as");
  else jar.set("escala-view-as", role, { ...COOKIE_OPTS, httpOnly: false });
  revalidatePath("/", "layout");
  return ok();
}
