import { civilWeekday, daysOfMonth, zonedTimeToUtc } from "@/lib/date";
import type { MassTemplate } from "@/lib/db/types";
import type { EventDraft } from "@/lib/schedule/types";

/**
 * Projects the weekly grid onto a month.
 *
 * The coordinator always adjusts the result (a novena, a solemnity, a Mass that
 * did not happen), so this is only the starting point - never the last word.
 */
export function generateMonthEvents(
  monthIso: string,
  templates: MassTemplate[],
  timeZone: string,
): EventDraft[] {
  const active = templates.filter((t) => t.active);
  const drafts: EventDraft[] = [];

  for (const [year, month, day] of daysOfMonth(monthIso)) {
    const weekday = civilWeekday(year, month, day);
    for (const t of active) {
      if (t.weekday !== weekday) continue;
      const [h, m] = t.start_time.split(":").map(Number);
      drafts.push({
        location_id: t.location_id,
        starts_at: zonedTimeToUtc(year, month, day, h, m ?? 0, timeZone).toISOString(),
        slots: t.slots,
        kind: "mass",
        signup_mode: "availability",
        label: t.label,
      });
    }
  }

  return drafts.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/**
 * How a novena day's label is put together: "Day 1 - Novena to Saint Joseph".
 *
 * The label is written to the database once, in whatever language the person
 * creating the schedule was reading, and is then read back by screens that
 * cannot know which language that was. So the two halves are joined by a fixed
 * separator instead of by a sentence connector ("of the", "da"): the devotion
 * name can be trimmed off again by splitting on the separator, in any locale.
 */
export const NOVENA_LABEL_SEPARATOR = " - ";

export function novenaEventLabel(dayLabel: string, title: string): string {
  return `${dayLabel}${NOVENA_LABEL_SEPARATOR}${title}`;
}

/** "Day 1 - Novena to Saint Joseph" → "Day 1" */
export function novenaDayOnly(label: string): string {
  const cut = label.indexOf(NOVENA_LABEL_SEPARATOR);
  return cut === -1 ? label : label.slice(0, cut);
}

/** "Day 1 - Novena to Saint Joseph" → "Novena to Saint Joseph" */
export function novenaTitleOf(label: string): string | null {
  const cut = label.indexOf(NOVENA_LABEL_SEPARATOR);
  return cut === -1 ? null : label.slice(cut + NOVENA_LABEL_SEPARATOR.length);
}

/**
 * The days of a novena from its first day: nine celebrations in a row, same
 * place, same time. That is how the ministry runs one today.
 *
 * `dayLabel` comes from the caller because the label is stored, and the server
 * has no language of its own - see `NOVENA_LABEL_SEPARATOR`.
 */
export function generateNovenaEvents({
  title,
  dayLabel,
  locationId,
  firstDay,
  hour,
  minute,
  slots,
  timeZone,
  days = 9,
}: {
  title: string;
  /** Translated name of the nth day, e.g. `(day) => t("novenaDay", { day })`. */
  dayLabel: (day: number) => string;
  locationId: string;
  firstDay: string; // "2026-11-13"
  hour: number;
  minute: number;
  slots: number;
  timeZone: string;
  days?: number;
}): EventDraft[] {
  const [y, m, d] = firstDay.split("-").map(Number);
  return Array.from({ length: days }, (_, i) => {
    const civil = new Date(Date.UTC(y, m - 1, d + i));
    return {
      location_id: locationId,
      starts_at: zonedTimeToUtc(
        civil.getUTCFullYear(),
        civil.getUTCMonth() + 1,
        civil.getUTCDate(),
        hour,
        minute,
        timeZone,
      ).toISOString(),
      slots,
      kind: "novena" as const,
      // A novena is filled directly: whoever wants a day takes it.
      signup_mode: "direct" as const,
      label: novenaEventLabel(dayLabel(i + 1), title),
    };
  });
}
