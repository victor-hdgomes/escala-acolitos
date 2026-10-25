import type {
  EventKind,
  EventRow,
  Location,
  Person,
  Schedule,
  SignupMode,
} from "@/lib/db/types";

/** Values interpolated into a translated message. */
export type TranslationValues = Record<string, string | number | Date>;

/**
 * A translator handed to the builders that compose text.
 *
 * WhatsApp messages, e-mails and the CSV export are assembled in plain
 * functions that have no hook and no request behind them, so the caller - a
 * client component with `useTranslations`, a Server Component with
 * `getTranslations`, or the reminder cron with the recipient's locale - binds
 * the namespace and passes the result down. Structural on purpose: it is the
 * smallest shape that both next-intl translators satisfy, and it keeps these
 * builders testable with a one-line stub.
 */
export type Translate = (key: string, values?: TranslationValues) => string;

/** A person as they appear in a list - the minimum needed to render and sort. */
export interface PersonLite {
  id: string;
  full_name: string;
  short_name: string | null;
  claimed_by: string | null;
  active: boolean;
}

export interface LocationLite {
  id: string;
  name: string;
  short_name: string | null;
  color: string;
  sort_order: number;
}

export interface SlotView {
  position: number;
  assignmentId: string | null;
  person: PersonLite | null;
  /** A swap opened on this slot. */
  swap: { id: string; token: string; reason: string | null } | null;
}

export interface EventView {
  id: string;
  starts_at: string;
  label: string | null;
  kind: EventKind;
  signup_mode: SignupMode;
  slots: number;
  location: LocationLite;
  slotsView: SlotView[];
  /** Who marked availability (only loaded on the coordination screens). */
  availablePeople: PersonLite[];
}

export interface DayGroup {
  key: string; // "2026-11-08"
  label: string; // "08 November"
  weekday: string; // "Sunday"
  events: EventView[];
}

export interface ScheduleDetail {
  schedule: Schedule;
  timezone: string;
  parishName: string;
  days: DayGroup[];
}

/** An event not yet stored, generated from the weekly grid. */
export interface EventDraft {
  location_id: string;
  starts_at: string;
  slots: number;
  kind: EventKind;
  signup_mode: SignupMode;
  label: string | null;
}

export type EventWithLocation = EventRow & { location: Location };
export type PersonFull = Person;
