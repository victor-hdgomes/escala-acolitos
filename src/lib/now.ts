/**
 * Reading the clock, isolated in a module of its own.
 *
 * Server Components legitimately read the time while rendering - every request
 * is a fresh render. The React Compiler rules treat `Date.now()` in a component
 * body as impure, so the call lives here and components ask for the time
 * through a named function, which also makes it explicit where time enters the
 * calculation.
 */

export function nowMs(): number {
  return Date.now();
}

export function nowDate(): Date {
  return new Date(nowMs());
}

/** The instant `days` days from now - used by the eve-of reminder. */
export function daysFromNow(days: number): Date {
  return new Date(nowMs() + days * 86_400_000);
}

export function isPast(iso: string): boolean {
  return Date.parse(iso) < nowMs();
}

export function daysSince(iso: string): number {
  return Math.floor((nowMs() - Date.parse(iso)) / 86_400_000);
}
