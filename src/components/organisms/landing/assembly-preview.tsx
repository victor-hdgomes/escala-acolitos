import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { LandingCaption } from "@/components/organisms/landing/landing-section";

/**
 * A still life of the assembly screen, built from divs.
 *
 * Not a screenshot: a screenshot would be in one language, would go stale on
 * the next UI change, and would need a real parish's names in it. This renders
 * from the message catalog, so it translates and ages with the product.
 *
 * The names are invented and labelled as an example - no real parish or person
 * is ever shown on this page.
 */
export async function AssemblyPreview() {
  const t = await getTranslations("landing.assemblyPreview");

  const filled = t.raw("filled") as string[];
  const suggestions = t.raw("suggestions") as Array<{
    name: string;
    reason: string;
    conflict?: boolean;
  }>;

  return (
    <figure className="mt-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium">{t("header")}</p>

        <ul className="mt-3 space-y-1.5">
          {filled.map((name) => (
            <li
              key={name}
              className="flex items-center gap-2 rounded-md border border-[color:var(--color-filled)]/40 bg-[color:var(--color-filled)]/5 px-2.5 py-1.5 text-sm"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-filled)]"
                aria-hidden
              />
              <span className="truncate">{name}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 rounded-md border border-dashed border-[color:var(--color-open)]/60 px-2.5 py-1.5 text-sm text-[color:var(--color-open)]">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-open)]"
              aria-hidden
            />
            {t("openSlot")}
          </li>
        </ul>

        <p className="mt-4 text-xs tracking-wide text-muted-foreground uppercase">
          {t("suggestedLabel")}
        </p>
        <ul className="mt-2 space-y-2">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.name}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="truncate">{suggestion.name}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                {suggestion.reason}
                {suggestion.conflict ? (
                  <AlertTriangle
                    className="h-3.5 w-3.5 text-[color:var(--color-pending)]"
                    aria-hidden
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <figcaption>
        <LandingCaption>{t("caption")}</LandingCaption>
      </figcaption>
    </figure>
  );
}
