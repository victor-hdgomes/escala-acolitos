import "server-only";

import { getLocale } from "next-intl/server";

import { createDateFormatter, type DateFormatter } from "@/lib/date";

/**
 * Date formatters for server rendering and for text the server composes -
 * WhatsApp messages, emails, CSV exports.
 *
 * Takes the zone explicitly because the server often formats on behalf of
 * someone else: the nightly reminder runs for every parish in turn, and each
 * one has its own clock.
 */
export async function getDateFormatter(timeZone: string): Promise<DateFormatter> {
  const locale = await getLocale();
  return createDateFormatter({ locale, timeZone });
}

/**
 * Same thing with the locale stated, for work that has no request behind it -
 * the reminder cron, which formats for a recipient rather than for a reader.
 */
export function getDateFormatterFor(
  locale: string,
  timeZone: string,
): DateFormatter {
  return createDateFormatter({ locale, timeZone });
}
