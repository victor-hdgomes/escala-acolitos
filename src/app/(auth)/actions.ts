"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { authErrorMessage, fail, ok, type ActionResult } from "@/lib/action-result";
import { appUrl } from "@/lib/public-access";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(authErrorMessage(error.message));

  const redirectTo = String(formData.get("redirect") || "/inicio");
  // Só caminho interno: um `redirect` vindo da query não pode mandar o
  // usuário para fora do app depois de autenticado.
  redirect(redirectTo.startsWith("/") ? redirectTo : "/inicio");
}

export async function signUpAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = credentials
    .extend({ displayName: z.string().trim().min(2, "Diga seu nome.") })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      displayName: formData.get("displayName"),
    });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: appUrl("/auth/callback"),
    },
  });
  if (error) return fail(authErrorMessage(error.message));

  const invite = String(formData.get("invite") || "");
  redirect(invite ? `/convite/${invite}` : "/inicio");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") || "").trim();
  if (!z.string().email().safeParse(email).success) {
    return fail("E-mail inválido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl("/auth/callback?next=/reset-password"),
  });
  if (error) return fail(authErrorMessage(error.message));
  return ok();
}

export async function resetPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") || "");
  if (password.length < 6) {
    return fail("A senha precisa ter pelo menos 6 caracteres.");
  }
  if (password !== String(formData.get("confirm") || "")) {
    return fail("As senhas não coincidem.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(authErrorMessage(error.message));
  redirect("/inicio");
}
