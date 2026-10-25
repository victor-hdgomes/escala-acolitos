import type { DateFormatter } from "@/lib/date";
import type { ScheduleKind } from "@/lib/db/types";
import { novenaDayOnly } from "@/lib/schedule/generate";
import type {
  DayGroup,
  EventView,
  ScheduleDetail,
  Translate,
} from "@/lib/schedule/types";

/**
 * The text the coordinator pastes into the group: WhatsApp messages and the
 * CSV export.
 *
 * None of it is rendered by React, so none of it can reach for a hook. Every
 * builder takes the translator and the date formatter the caller already has -
 * `useTranslations("whatsapp")` plus `useDateFormatter()` in a client
 * component, `getTranslations` plus `getDateFormatter` on the server. The
 * parish's time zone rides along inside the formatter.
 */
interface TextContext {
  t: Translate;
  df: DateFormatter;
}

export function personLabel(p: {
  full_name: string;
  short_name: string | null;
}): string {
  return p.short_name?.trim() || p.full_name;
}

function namesOf(event: EventView): string[] {
  return event.slotsView
    .filter((s) => s.person)
    .map((s) => personLabel(s.person!));
}

/**
 * In a novena's own schedule the title already says which devotion it is;
 * repeating the name on each of the nine days only makes the message longer.
 * "Day 1 - Novena to Saint Joseph" becomes "Day 1".
 */
function eventLabel(label: string | null, kind?: ScheduleKind): string | null {
  if (!label || kind !== "novena") return label;
  return novenaDayOnly(label);
}

/** "Sunday, 08/11 at 7:30 PM" - the one way this product names an instant. */
function whenOf({ t, df }: TextContext, startsAt: string): string {
  return t("when", {
    weekday: df.weekday(startsAt),
    date: df.shortDate(startsAt),
    time: df.time(startsAt),
  });
}

/**
 * The month name in the three casings the messages need.
 *
 * Casing is part of a language's grammar, not of the data: English keeps
 * "November" capitalised mid-sentence and Portuguese does not. So all three
 * forms go into the message and each locale's copy picks the one it wants.
 */
export function monthForms(df: DateFormatter, monthIso: string) {
  const month = df.monthLabel(monthIso);
  return {
    month,
    monthLower: month.toLowerCase(),
    monthUpper: month.toUpperCase(),
  };
}

/**
 * The message that opens the filling - the equivalent of the "Morning,
 * everyone" the coordinator posts today in the group with the Google Forms
 * link.
 */
export function buildInviteMessage({
  t,
  df,
  schedule,
  url,
  deadlineLabel,
  hasNovena,
}: TextContext & {
  schedule: { title: string; month: string; kind?: ScheduleKind };
  url: string;
  deadlineLabel: string | null;
  hasNovena: boolean;
}): string {
  const isNovena = schedule.kind === "novena";
  const lines = [
    t("invite.greeting"),
    "",
    isNovena
      ? t("invite.openedNovena", { title: schedule.title })
      : t("invite.openedMonthly", monthForms(df, schedule.month)),
    "",
    url,
    "",
  ];
  // Only worth mentioning when the novena sits inside the month's schedule; if
  // it has a schedule of its own, this link is already that one.
  if (hasNovena && !isNovena) {
    lines.push(t("invite.novenaIncluded"), "");
  }
  if (deadlineLabel) {
    lines.push(t("invite.deadline", { deadline: deadlineLabel }));
  }
  lines.push(
    "",
    isNovena ? t("invite.howToNovena") : t("invite.howToMonthly"),
  );
  return lines.join("\n");
}

/** The "schedule is out" message. */
export function buildPublishedMessage({
  t,
  df,
  schedule,
  url,
}: TextContext & {
  schedule: { title: string; month: string; kind?: ScheduleKind };
  url: string;
}): string {
  return [
    schedule.kind === "novena"
      ? t("published.titleNovena", { title: schedule.title.toUpperCase() })
      : t("published.titleMonthly", monthForms(df, schedule.month)),
    "",
    t("published.body"),
    url,
    "",
    t("published.footer"),
  ].join("\n");
}

/**
 * The whole schedule as text, grouped by day. WhatsApp renders no table, so the
 * document's columns become a list - longer, but readable on a phone, which is
 * where this gets read.
 */
export function buildScheduleText({
  t,
  df,
  detail,
}: TextContext & { detail: ScheduleDetail }): string {
  const { schedule, days } = detail;
  const out: string[] = [
    schedule.kind === "monthly"
      ? t("scheduleText.titleMonthly", monthForms(df, schedule.month))
      : t("scheduleText.titleOther", { title: schedule.title.toUpperCase() }),
    "",
  ];

  for (const day of days) {
    const first = day.events[0];
    if (!first) continue;
    out.push(
      t("scheduleText.dayHeading", {
        weekday: df.weekday(first.starts_at),
        date: df.shortDate(first.starts_at),
      }),
    );
    for (const ev of day.events) {
      const names = namesOf(ev);
      const label = eventLabel(ev.label, schedule.kind);
      out.push(
        label
          ? t("scheduleText.eventLineWithLabel", {
              time: df.time(ev.starts_at),
              location: ev.location.name,
              label,
            })
          : t("scheduleText.eventLine", {
              time: df.time(ev.starts_at),
              location: ev.location.name,
            }),
      );
      out.push(
        names.length
          ? t("scheduleText.namesLine", { names: names.join(", ") })
          : t("scheduleText.noNames"),
      );
    }
    out.push("");
  }

  return out.join("\n").trimEnd();
}

/**
 * The novena format the group already uses, with the slots numbered and the
 * empty ones spelled out - that is what makes clear what is left to fill.
 */
export function buildNovenaText({
  t,
  df,
  title,
  events,
}: TextContext & {
  title: string;
  events: EventView[];
}): string {
  const out: string[] = [t("novenaText.title", { title: title.toUpperCase() }), ""];

  for (const ev of events) {
    out.push(t("novenaText.eventLine", { when: whenOf({ t, df }, ev.starts_at) }));
    for (let i = 1; i <= ev.slots; i++) {
      const slot = ev.slotsView.find((s) => s.position === i);
      out.push(
        t("novenaText.slotLine", {
          position: i,
          name: slot?.person ? personLabel(slot.person) : "",
        }),
      );
    }
  }

  return out.join("\n");
}

/** A swap request ready to paste into the group. */
export function buildSwapMessage({
  t,
  df,
  personName,
  event,
  url,
  reason,
}: TextContext & {
  personName: string;
  event: { starts_at: string; locationName: string };
  url: string;
  reason?: string | null;
}): string {
  return [
    t("swap.title"),
    "",
    t("swap.body", {
      person: personName,
      when: whenOf({ t, df }, event.starts_at),
      location: event.locationName,
    }),
    reason ? t("swap.reason", { reason }) : "",
    "",
    t("swap.callToAction"),
    url,
  ]
    .filter(Boolean)
    .join("\n");
}

/** A nudge for whoever has not answered yet. */
export function buildReminderMessage({
  t,
  url,
  pendingNames,
  deadlineLabel,
}: Pick<TextContext, "t"> & {
  url: string;
  pendingNames: string[];
  deadlineLabel: string | null;
}): string {
  return [
    t("reminder.title"),
    "",
    pendingNames.length
      ? t("reminder.pending", { names: pendingNames.join(", ") })
      : t("reminder.pendingUnknown"),
    "",
    deadlineLabel ? t("reminder.deadline", { deadline: deadlineLabel }) : "",
    url,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * CSV in the shape of the spreadsheet they use today: one row per celebration,
 * one column per slot. It is what lets the result be pasted where the ministry
 * already works.
 */
export function buildScheduleCsv({
  t,
  df,
  detail,
}: TextContext & { detail: ScheduleDetail }): string {
  const { days } = detail;
  const maxSlots = Math.max(
    1,
    ...days.flatMap((d) => d.events.map((e) => e.slots)),
  );

  const header = [
    t("csv.date"),
    t("csv.weekday"),
    t("csv.time"),
    t("csv.location"),
    ...Array.from({ length: maxSlots }, () => t("csv.server")),
  ];

  const rows = days.flatMap((day: DayGroup) =>
    day.events.map((ev) => {
      const names = ev.slotsView
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((s) => (s.person ? personLabel(s.person) : ""));
      const label = eventLabel(ev.label, detail.schedule.kind);
      return [
        df.fullDate(ev.starts_at),
        df.weekday(ev.starts_at).toUpperCase(),
        df.time(ev.starts_at).toUpperCase(),
        label
          ? t("csv.locationWithLabel", { location: ev.location.name, label })
          : ev.location.name,
        ...Array.from({ length: maxSlots }, (_, i) => names[i] ?? ""),
      ];
    }),
  );

  return [header, ...rows]
    .map((cols) => cols.map(csvCell).join(";"))
    .join("\r\n");
}

function csvCell(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
