import type {
  EventKind,
  EventRow,
  Location,
  Person,
  Schedule,
  SignupMode,
} from "@/lib/db/types";

/** Pessoa como aparece numa lista — o mínimo para renderizar e ordenar. */
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
  /** Substituição aberta nesta vaga. */
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
  /** Quem marcou disponibilidade (só carregado nas telas de coordenação). */
  availablePeople: PersonLite[];
}

export interface DayGroup {
  key: string; // "2026-11-08"
  label: string; // "08 de novembro"
  weekday: string; // "Domingo"
  events: EventView[];
}

export interface ScheduleDetail {
  schedule: Schedule;
  timezone: string;
  parishName: string;
  days: DayGroup[];
}

/** Evento ainda não gravado, gerado a partir da grade semanal. */
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
