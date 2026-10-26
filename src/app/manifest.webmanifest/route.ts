import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";

/**
 * The manifest that makes the app installable on a phone, which is where it
 * lives. The icons are not decoration: a browser refuses to offer an install
 * at all without a 192 and a 512, and the install button has nothing native
 * to open until it does.
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
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  });
}
