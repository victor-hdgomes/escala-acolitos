/**
 * The design tokens in TypeScript, for the places that need them as values
 * rather than as CSS: chart series, colour scales computed at run time. Same
 * scale as globals.css, which stays the source of truth for the themes.
 */

export const tokens = {
  color: {
    filled: "var(--color-filled)",
    open: "var(--color-open)",
    pending: "var(--color-pending)",
    novena: "var(--color-novena)",
    chart: [
      "var(--color-chart-1)",
      "var(--color-chart-2)",
      "var(--color-chart-3)",
      "var(--color-chart-4)",
      "var(--color-chart-5)",
    ],
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
  },
  radius: {
    sm: "calc(var(--radius) - 4px)",
    md: "calc(var(--radius) - 2px)",
    lg: "var(--radius)",
    xl: "calc(var(--radius) + 4px)",
  },
  motion: {
    fast: "150ms",
    base: "250ms",
    slow: "400ms",
    ease: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
} as const;

export type Tokens = typeof tokens;
