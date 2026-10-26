"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  ERROR_CODES,
  authErrorCode,
  fail,
  ok,
  zodErrorCode,
  type ActionResult,
} from "@/lib/action-result";
import { appUrl } from "@/lib/public-access";
import { safeInternalPath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().email(ERROR_CODES.INVALID_EMAIL),
  password: z.string().min(6, ERROR_CODES.PASSWORD_TOO_SHORT),
});

export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(authErrorCode(error.message));

  redirect(safeInternalPath(String(formData.get("redirect") || "")));
}

export async function signUpAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = credentials
    .extend({
      displayName: z.string().trim().min(2, ERROR_CODES.DISPLAY_NAME_REQUIRED),
    })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      displayName: formData.get("displayName"),
    });
  if (!parsed.success) return fail(zodErrorCode(parsed.error.issues[0].message));

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: appUrl("/auth/callback"),
    },
  });
  if (error) return fail(authErrorCode(error.message));

  // Whichever way in they arrived on, sign-up hands them straight back to
  // it: the group link, the named invitation, or the waiting screen.
  const invite = String(formData.get("invite") || "");
  if (invite) redirect(`/invite/${invite}`);
  const join = String(formData.get("join") || "");
  redirect(join ? `/j/${join}` : "/home");
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
    return fail(ERROR_CODES.INVALID_EMAIL);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl("/auth/callback?next=/reset-password"),
  });
  if (error) return fail(authErrorCode(error.message));
  return ok();
}

export async function resetPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") || "");
  if (password.length < 6) {
    return fail(ERROR_CODES.PASSWORD_TOO_SHORT);
  }
  if (password !== String(formData.get("confirm") || "")) {
    return fail(ERROR_CODES.PASSWORDS_DO_NOT_MATCH);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(authErrorCode(error.message));
  redirect("/home");
}
