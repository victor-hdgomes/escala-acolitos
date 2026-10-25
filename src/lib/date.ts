/**
 * Dates, always in the parish's time zone and the reader's language.
 *
 * Two independent axes that are easy to confuse:
 *
 *   TIME ZONE belongs to the parish. `events.starts_at` is a timestamptz - an
 *   absolute instant - and an 8 AM Mass is 8 AM in Goiânia whether the reader
 *   is in Manaus or Lisbon. Nothing here uses getDate()/getHours(), which
 *   would silently answer in the server's zone.
 *
 *   LANGUAGE belongs to the reader. Month and weekday names, time format
 *   (08h00 vs 8:00 AM) and date order all follow the locale, not the parish.
 *
 * So every formatter needs both, and `createDateFormatter` binds them once
 * instead of threading two arguments through every call site.
 */

/** A calendar instant already resolved into a specific time zone. */
export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAY_INDEX = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(date);

  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const weekdayName = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const weekday = WEEKDAY_INDEX.indexOf(weekdayName);

  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    // Some implementations report midnight as hour 24.
    hour: num("hour") % 24,
    minute: num("minute"),
    second: num("second"),
    weekday: weekday < 0 ? 0 : weekday,
  };
}

export function zonedParts(date: Date | string, timeZone: string): ZonedParts {
  const value = typeof date === "string" ? new Date(date) : date;
  const { year, month, day, hour, minute, weekday } = partsIn(value, timeZone);
  return { year, month, day, hour, minute, weekday };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/**
 * Wall-clock time in a zone → the absolute instant.
 *
 * Two passes because the offset depends on the very date being converted:
 * a first guess lands near the answer, and the second corrects it across a
 * daylight-saving boundary.
 */
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetMs(new Date(guess), timeZone);
  let result = new Date(guess - first);
  const second = offsetMs(result, timeZone);
  if (second !== first) result = new Date(guess - second);
  return result;
}

/** "2026-11-08" in the parish's zone - the key everything groups by. */
export function dayKey(date: Date | string, timeZone: string): string {
  const { year, month, day } = zonedParts(date, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Part of the day, used by the quick filters on the availability form. */
export function periodOf(
  date: Date | string,
  timeZone: string,
): "morning" | "afternoon" | "night" {
  const { hour } = zonedParts(date, timeZone);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "night";
}

/** Weekday of a civil date, with no time zone involved. 0 = Sunday. */
export function civilWeekday(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Every day of a month, as [year, month, day]. */
export function daysOfMonth(monthIso: string): Array<[number, number, number]> {
  const [year, month] = monthIso.split("-").map(Number);
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => [year, month, i + 1]);
}

/** Shifts a "2026-11-01" by whole months. */
export function addMonths(monthIso: string, delta: number): string {
  const [year, month] = monthIso.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-01`;
}

/** First day of the current month, in the parish's zone. */
export function currentMonthIso(timeZone: string): string {
  const { year, month } = zonedParts(new Date(), timeZone);
  return `${year}-${pad(month)}-01`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export interface DateFormatterOptions {
  locale: string;
  timeZone: string;
}

/**
 * Every date format the product needs, bound to one locale and one zone.
 *
 * Built once per render and passed down, so a component never has to know
 * which parish it is rendering or which language the reader chose. The
 * `Intl.DateTimeFormat` instances are created here rather than per call - they
 * are expensive, and a month view formats a few hundred dates.
 */
export function createDateFormatter({ locale, timeZone }: DateFormatterOptions) {
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayMonth = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "long",
  });
  const shortDate = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
  });
  const fullDate = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const weekdayLong = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
  });
  const weekdayShort = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
  });
  const monthYear = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const asDate = (value: Date | string) =>
    typeof value === "string" ? new Date(value) : value;

  return {
    locale,
    timeZone,

    /** "08:00" or "8:00 AM", following the locale. */
    time: (value: Date | string) => time.format(asDate(value)),

    /** "08 November" / "08 de novembro" */
    dayMonth: (value: Date | string) => dayMonth.format(asDate(value)),

    /** "08/11" */
    shortDate: (value: Date | string) => shortDate.format(asDate(value)),

    /** "08/11/2026" */
    fullDate: (value: Date | string) => fullDate.format(asDate(value)),

    /** "Sunday" / "domingo" */
    weekday: (value: Date | string) => weekdayLong.format(asDate(value)),

    /** "Sun" / "dom." */
    weekdayShort: (value: Date | string) => weekdayShort.format(asDate(value)),

    /**
     * "November 2026" from a Postgres `date` ("2026-11-01").
     *
     * Formatted in UTC on purpose: the value is a calendar month, not an
     * instant, and shifting it into a western zone would show October.
     */
    monthLabel: (monthIso: string) =>
      capitalize(monthYear.format(new Date(`${monthIso}T12:00:00Z`))),

    /** "in 3 days", "tomorrow", "today" - whole days, in the parish's zone. */
    relativeDays: (value: Date | string) => {
      const target = dayKey(value, timeZone);
      const today = dayKey(new Date(), timeZone);
      const days = Math.round(
        (Date.parse(`${target}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
          86_400_000,
      );
      return relative.format(days, "day");
    },

    /** Weekday names for pickers, starting on Sunday. */
    weekdayNames: (style: "long" | "short" = "long") => {
      const formatter = style === "long" ? weekdayLong : weekdayShort;
      // 2024-01-07 was a Sunday; any known Sunday works as the anchor.
      return Array.from({ length: 7 }, (_, i) =>
        capitalize(formatter.format(new Date(Date.UTC(2024, 0, 7 + i, 12)))),
      );
    },
  };
}

export type DateFormatter = ReturnType<typeof createDateFormatter>;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Parses "HH:MM[:SS]" from Postgres into hours and minutes. */
export function parseTimeOfDay(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(":").map(Number);
  return { hour: hour || 0, minute: minute || 0 };
}
