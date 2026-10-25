/**
 * Locale configuration.
 *
 * English is the source language: UI copy is authored in `en` and every other
 * locale is a translation of it. Keys are never written in another language.
 *
 * No locale segment in the URL. The product's most important links are pasted
 * into WhatsApp groups by volunteers - `/e/a1b2c3` survives that trip, and
 * `/pt-BR/e/a1b2c3` invites someone to mangle it. The locale travels in a
 * cookie instead, which also means a link shared between two people renders in
 * each reader's own language.
 */

export const LOCALES = ["en", "pt-BR"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "locale";

/** Label shown in the language picker, each in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Português (Brasil)",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Best locale for an `Accept-Language` header, used only on a first visit when
 * no cookie exists yet. Matches the exact tag first ("pt-BR"), then the base
 * language ("pt"), so a Brazilian phone defaults to Portuguese without anyone
 * choosing anything.
 */
export function matchLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const requested = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.trim(), quality: q ? Number(q) : 1 };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of requested) {
    const exact = LOCALES.find((l) => l.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;

    const base = tag.split("-")[0].toLowerCase();
    const byBase = LOCALES.find((l) => l.split("-")[0].toLowerCase() === base);
    if (byBase) return byBase;
  }

  return DEFAULT_LOCALE;
}
