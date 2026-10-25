/**
 * The time zones a parish can be set to.
 *
 * Brazil spans four offsets and the product is used across them, so the list
 * is the country's IANA zones rather than a global picker nobody would scroll.
 *
 * The labels are derived from the id instead of being authored: they are place
 * names, which read the same in every language, and deriving them means a zone
 * can be added here without touching the message catalog.
 */

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export const TIMEZONES = [
  DEFAULT_TIMEZONE,
  "America/Manaus",
  "America/Cuiaba",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Rio_Branco",
  "America/Boa_Vista",
  "America/Campo_Grande",
] as const;

/** "America/Campo_Grande" → "Campo Grande". */
export function timeZoneLabel(timeZone: string): string {
  return timeZone.replace("America/", "").replace(/_/g, " ");
}

/** Ready for `<FormSelect options={...}>`; built once, not per render. */
export const TIMEZONE_OPTIONS = TIMEZONES.map((value) => ({
  value,
  label: timeZoneLabel(value),
}));
