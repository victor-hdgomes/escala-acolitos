import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

/**
 * Minimal manifest: the app is installable on a phone, which is where it
 * lives. No icons of its own yet - the browser falls back to the favicon.
 *
 * Built per request rather than as a static file: the name, the description
 * and `lang` follow the reader's locale, which lives in a cookie.
 */
export async function GET() {
  const [locale, tApp, t] = await Promise.all([
    getLocale(),
    getTranslations("app"),
    getTranslations("shell"),
  ]);

  return NextResponse.json({
    name: tApp("name"),
    short_name: t("brand.short"),
    description: t("manifest.description"),
    start_url: "/home",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: locale,
    orientation: "portrait",
  });
}
