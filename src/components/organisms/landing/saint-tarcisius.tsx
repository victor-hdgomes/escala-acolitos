import { cn } from "@/lib/utils";

/**
 * Saint Tarcisius - the house mark.
 *
 * A boy seen from the chest up inside a round-headed arch, arms folded over a
 * host pressed to his chest. Drawn, not photographed: there is no authentic
 * likeness of a third-century Roman boy, and a stock image of one would be a
 * lie dressed as piety.
 *
 * Deliberately faceless. A mouth or a pair of eyes at this scale turns a
 * reverent mark into a cartoon, and the dignity is gone. The chest-up crop
 * removes the hem-and-feet problem with no gradient mask.
 *
 * The stroke hierarchy carries the whole meaning: the host is the heaviest
 * line on the page, heavier than the boy himself, because it is the one thing
 * he would not let go of. Everything inherits `currentColor` except the host,
 * its cross and the halo, which take the amber token - the single warm point
 * on a neutral page, lamplight rather than gold leaf.
 */
export function SaintTarcisius({
  /**
   * "full" for the dedicated band; "compact" below ~32px, where the thin
   * strokes of the full drawing collapse into grey mush.
   */
  variant = "full",
  className,
  title,
}: {
  variant?: "full" | "compact";
  className?: string;
  /** Accessible name. Omit only where an adjacent label already says it. */
  title?: string;
}) {
  const shared = {
    viewBox: "0 0 120 120",
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    role: title ? ("img" as const) : undefined,
    "aria-hidden": title ? undefined : true,
  };

  if (variant === "compact") {
    return (
      <svg {...shared} className={cn("h-7 w-7", className)}>
        {title ? <title>{title}</title> : null}
        <path
          d="M16 112 V52 A44 44 0 0 1 104 52 V112"
          strokeWidth={2}
          opacity={0.45}
        />
        <circle cx="60" cy="44" r="11" strokeWidth={2.4} />
        <path
          d="M31 112 C31 84 41 68 60 68 C79 68 89 84 89 112"
          strokeWidth={2.4}
        />
        <path d="M38 84 L57 97 M82 84 L63 97" strokeWidth={2.4} />
        <circle
          cx="60"
          cy="87"
          r="10.5"
          strokeWidth={3.2}
          stroke="var(--pending)"
          fill="var(--pending)"
          fillOpacity={0.15}
        />
      </svg>
    );
  }

  return (
    <svg {...shared} className={cn("h-42 w-42", className)}>
      {title ? <title>{title}</title> : null}

      {/* Architecture: an arch and a floor line, kept faint so the figure
          stays the subject. Raised slightly in light mode, where low opacity
          on a white ground disappears entirely. */}
      <path
        d="M16 112 V52 A44 44 0 0 1 104 52 V112"
        strokeWidth={1}
        className="opacity-25 dark:opacity-[0.18]"
      />
      <path
        d="M26 112 V58 A34 34 0 0 1 94 58 V112"
        strokeWidth={1}
        className="opacity-[0.16] dark:opacity-10"
      />
      <path
        d="M8 112 H112"
        strokeWidth={1}
        className="opacity-[0.22] dark:opacity-[0.16]"
      />

      {/* Halo as an open arc in perspective - never a flat disc, which reads
          as a sticker rather than light. */}
      <path
        d="M43 31 A17 8 0 0 1 77 31"
        strokeWidth={1}
        stroke="var(--pending)"
        opacity={0.5}
      />

      {/* Head filled with the page background so the shoulder curve behind it
          does not show through the neck. */}
      <ellipse
        cx="60"
        cy="44"
        rx="11"
        ry="12.5"
        transform="rotate(-6 60 44)"
        strokeWidth={1.6}
        fill="var(--background)"
      />
      <path d="M49.5 39 Q60 32 70.5 39" strokeWidth={1.6} />
      <path d="M55 56 V68 M65 56 V68" strokeWidth={1.4} opacity={0.75} />

      <path
        d="M31 112 C31 84 41 68 60 68 C79 68 89 84 89 112"
        strokeWidth={1.6}
      />
      <path d="M50 71 Q60 78 70 71" strokeWidth={1.2} opacity={0.55} />

      <path d="M36 84 C40 96 48 100 57 97" strokeWidth={1.6} />
      <path d="M84 84 C80 96 72 100 63 97" strokeWidth={1.6} />
      <path d="M55 97 Q60 101 65 97" strokeWidth={1.4} opacity={0.7} />

      {/* The host: the heaviest stroke in the drawing. */}
      <circle
        cx="60"
        cy="87"
        r="10.5"
        strokeWidth={2.4}
        stroke="var(--pending)"
        fill="var(--pending)"
        fillOpacity={0.1}
      />
      <path
        d="M60 81 V93 M54 87 H66"
        strokeWidth={1}
        stroke="var(--pending)"
        opacity={0.55}
      />
    </svg>
  );
}
