import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, matchLocale } from "./config";

/**
 * Resolves the locale for every server render.
 *
 * Order: an explicit choice (cookie) beats the browser's preference, which
 * beats the source language. Deliberately does not read the database - this
 * runs on public token pages too, where there is no account to read from.
 */
export default getRequestConfig(async () => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);

  const chosen = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(chosen)
    ? chosen
    : matchLocale(headerList.get("accept-language"));

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Dates and numbers follow the reader's locale, but never the reader's
    // clock: every schedule renders in its own parish's time zone, which the
    // date helpers take explicitly.
    now: undefined,
    onError(error) {
      // A missing translation must not blank out a page for a volunteer in a
      // sacristy. Fall back loudly in development, silently in production.
      if (process.env.NODE_ENV === "development") console.warn(error.message);
    },
    getMessageFallback({ key, namespace }) {
      return process.env.NODE_ENV === "development"
        ? `⟦${namespace ? `${namespace}.` : ""}${key}⟧`
        : key.split(".").pop() || key;
    },
  };
});

export { DEFAULT_LOCALE };
