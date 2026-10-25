import { getTranslations } from "next-intl/server";

import { LandingCaption } from "@/components/organisms/landing/landing-section";
import { cn } from "@/lib/utils";

/**
 * The three numbers the old Google Form never gave a coordinator.
 *
 * Each number wears the colour it wears inside the app, so the page teaches
 * the legend before anyone signs up: green for answered, coral for a Mass
 * still short of people.
 */
export async function ResponseCounters() {
  const t = await getTranslations("landing.counters");

  const items = [
    { value: t("repliedValue"), label: t("repliedLabel"), tone: "filled" },
    { value: t("pendingValue"), label: t("pendingLabel"), tone: "muted" },
    { value: t("shortValue"), label: t("shortLabel"), tone: "open" },
  ] as const;

  return (
    <figure className="mt-6">
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-border bg-card px-3 py-4 text-center"
          >
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                item.tone === "filled" && "text-[color:var(--color-filled)]",
                item.tone === "open" && "text-[color:var(--color-open)]",
                item.tone === "muted" && "text-muted-foreground",
              )}
            >
              {item.value}
            </p>
            <p className="mt-1 text-xs leading-tight text-balance text-muted-foreground">
              {item.label}
            </p>
          </div>
        ))}
      </div>
      <figcaption>
        <LandingCaption>{t("caption")}</LandingCaption>
      </figcaption>
    </figure>
  );
}
