import { cn } from "@/lib/utils";

/**
 * One band of the landing page.
 *
 * The page is a single column of bands separated by a hairline. Variants exist
 * so the composition stays in one place instead of being re-derived with
 * slightly different padding in nine sections.
 */
export function LandingSection({
  children,
  tone = "plain",
  className,
}: {
  children: React.ReactNode;
  /**
   * "plain" - the default band.
   * "recessed" - a muted ground, for the two bands that need to feel apart.
   * "shrine" - the Saint Tarcisius band: the most air on the page, and the
   *   only one shaped as an arch.
   */
  tone?: "plain" | "recessed" | "shrine";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-t border-border/60",
        tone === "plain" && "py-14 sm:py-20",
        tone === "recessed" && "bg-muted/40 py-14 sm:py-20",
        tone === "shrine" &&
          "rounded-t-[7rem] border border-border bg-muted/40 py-24 sm:py-32",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[34rem] px-5 sm:max-w-2xl">
        {children}
      </div>
    </section>
  );
}

export function LandingHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-xl font-semibold tracking-tight text-balance sm:text-2xl",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function LandingProse({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-base leading-relaxed text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function LandingEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

/** Caption under an illustrative card, so no one reads it as live data. */
export function LandingCaption({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-muted-foreground">{children}</p>;
}
