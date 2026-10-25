"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";

/**
 * Remembers the reader's language choice.
 *
 * A cookie rather than a column: the people who read this product the most -
 * altar servers opening a shared link - have no account to attach a preference
 * to. Signed-in users get the same mechanism, so there is one code path.
 */
export async function setLocaleAction(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
