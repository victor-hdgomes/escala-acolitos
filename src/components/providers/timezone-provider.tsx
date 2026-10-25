"use client";

import * as React from "react";
import { useLocale } from "next-intl";

import { createDateFormatter, type DateFormatter } from "@/lib/date";

/**
 * Carries the parish's time zone down the tree.
 *
 * Every screen in the product renders one parish at a time, and every date on
 * it belongs to that parish's clock. Passing the zone through props reached
 * about thirty components and was forgotten in a few of them - which is how a
 * 7 PM Mass renders as 10 PM for a reader in another state.
 */
const TimeZoneContext = React.createContext<string | null>(null);

export function TimeZoneProvider({
  timeZone,
  children,
}: {
  timeZone: string;
  children: React.ReactNode;
}) {
  return (
    <TimeZoneContext.Provider value={timeZone}>
      {children}
    </TimeZoneContext.Provider>
  );
}

export function useTimeZone(): string {
  const timeZone = React.useContext(TimeZoneContext);
  if (!timeZone) {
    throw new Error("useTimeZone must be used inside <TimeZoneProvider>");
  }
  return timeZone;
}

/**
 * Date formatters bound to the reader's language and the parish's zone.
 *
 * Memoised on both, so a list of forty celebrations builds its
 * `Intl.DateTimeFormat` instances once instead of once per row.
 */
export function useDateFormatter(): DateFormatter {
  const locale = useLocale();
  const timeZone = useTimeZone();

  return React.useMemo(
    () => createDateFormatter({ locale, timeZone }),
    [locale, timeZone],
  );
}
