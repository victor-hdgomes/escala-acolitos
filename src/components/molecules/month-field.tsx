"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { useLocale } from "next-intl";

import { addMonths } from "@/lib/date";
import { nowDate } from "@/lib/now";
import { cn } from "@/lib/utils";

/**
 * The month picker, as a plain `<select>`.
 *
 * `<input type="month">` exists only in Chromium. Safari (desktop and iOS)
 * and Firefox fall back to a bare text box that accepts nothing but a typed
 * "2026-11", and the month is the one field nobody can skip when opening a
 * schedule. A native select costs every browser the same and hands a phone
 * the OS wheel picker, which is the control these readers already know.
 */

/** The window a coordinator ever opens: last month, this one, and the year ahead. */
const MONTHS_BEHIND = 1;
const MONTHS_AHEAD = 12;

export function MonthField({
  id,
  name,
  defaultValue,
  className,
  required,
  referenceMonth,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  className?: string;
  required?: boolean;
  /** "2026-11": the month the window is built around. Defaults to the current one. */
  referenceMonth?: string;
}) {
  const locale = useLocale();

  /*
   * Pinned to UTC, and deliberately not the parish zone: a month carries no
   * instant, the anchor below is a UTC date, and answering in the reader's own
   * zone would label it "October 2026" on any phone west of Greenwich and
   * disagree with the markup the server already sent.
   */
  const formatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "UTC",
        month: "long",
        year: "numeric",
      }),
    [locale],
  );

  const { options, fallback } = React.useMemo(() => {
    // The clock is read here rather than in the render body, and only when the
    // caller has no month of its own to centre the list on.
    const anchor = referenceMonth ?? currentMonth();

    const months: string[] = [];
    for (let delta = -MONTHS_BEHIND; delta <= MONTHS_AHEAD; delta += 1) {
      months.push(addMonths(`${anchor}-01`, delta).slice(0, 7));
    }
    // An existing schedule can sit outside that window, and leaving its month
    // out would make the select quietly submit a different one.
    if (defaultValue && !months.includes(defaultValue)) {
      months.push(defaultValue);
    }
    months.sort();

    return {
      options: months.map((value) => ({
        value,
        label: capitalize(formatter.format(new Date(`${value}-01T12:00:00Z`))),
      })),
      fallback: anchor,
    };
  }, [referenceMonth, defaultValue, formatter]);

  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        data-slot="month-field"
        defaultValue={defaultValue ?? fallback}
        required={required}
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-input bg-transparent py-1 pr-9 pl-3 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          // A finger gets the project's 44px and the 16px that stops iOS
          // zooming the page on focus; a mouse keeps the compact field the
          // rest of the form uses.
          "pointer-coarse:min-h-11 pointer-fine:md:text-sm",
          // Chromium draws the open list on its own light surface and would
          // paint our dark-mode foreground onto it.
          "[&_option]:bg-background [&_option]:text-foreground",
          className,
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-50"
      />
    </div>
  );
}

/** "2026-11". UTC so the server and the phone agree while hydrating. */
function currentMonth(): string {
  const now = nowDate();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

/** pt-BR hands back "novembro de 2026", and months read capitalised everywhere else. */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
