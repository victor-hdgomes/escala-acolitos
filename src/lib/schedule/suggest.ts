import type { PersonLite } from "@/lib/schedule/types";

/**
 * The per-person numbers that feed the suggestion. They come from a single
 * query, aggregated on the server - see `lib/schedule/queries.ts`.
 */
export interface PersonStats {
  /** Times already given to them in this schedule (the month being built). */
  monthCount: number;
  /** Times served in the last 90 days, across earlier months too. */
  recentCount: number;
  /** How often they have served at this location, historically. */
  locationCount: number;
  /** Days since they last served; null = never served. */
  daysSinceLast: number | null;
  /** How many celebrations they marked as available in this schedule. */
  availabilityCount: number;
}

/**
 * Why a candidate landed where they did, as a code rather than a sentence.
 *
 * The ranking runs wherever the coordinator's screen renders, and the reader's
 * language is not known here - so the reason travels as a code plus the number
 * it needs, and the screen renders it through the message catalog.
 */
export type SuggestionReasonCode =
  | "noneThisMonth"
  | "timesThisMonth"
  | "neverServed"
  | "lastServedDaysAgo"
  | "servedHereTimes"
  | "neverServedHere"
  | "fewDatesGiven"
  | "noAvailability"
  | "busyOnOtherSchedule"
  | "busySameDay"
  | "alreadyInEvent";

export interface SuggestionReason {
  code: SuggestionReasonCode;
  /** Interpolated into the translated sentence; counts only. */
  values?: Record<string, number>;
}

export interface Suggestion {
  person: PersonLite;
  score: number;
  available: boolean;
  /** Already scheduled for another celebration on the same day. */
  sameDayConflict: boolean;
  /** The day's conflict came from another schedule (e.g. a standalone novena). */
  otherScheduleConflict: boolean;
  /** Already scheduled for this celebration. */
  alreadyInEvent: boolean;
  reasons: SuggestionReason[];
}

const EMPTY_STATS: PersonStats = {
  monthCount: 0,
  recentCount: 0,
  locationCount: 0,
  daysSinceLast: null,
  availabilityCount: 0,
};

/**
 * Names sort with accents folded, so "Álvaro" lands next to "Alvaro". Pinned to
 * one collation rather than the reader's, because the order has to be the same
 * on the server and in the browser or the list reshuffles on hydration.
 */
const byName = new Intl.Collator("en", { sensitivity: "base" });

/**
 * Orders the candidates for a slot. It schedules nobody: it only decides who
 * shows up first in the coordinator's list.
 *
 * The heaviest weight is balance within the month - that is the real
 * complaint, some serve five times and others not at all. Affinity with a
 * location comes in as a light tie-breaker, so that "so-and-so belongs to Saint
 * George's" never sets in.
 */
export function rankCandidates({
  people,
  statsById,
  availableIds,
  sameDayIds,
  otherScheduleDayIds,
  eventPersonIds,
  includeUnavailable = false,
}: {
  people: PersonLite[];
  statsById: Map<string, PersonStats>;
  availableIds: Set<string>;
  sameDayIds: Set<string>;
  /** Busy on the same day through another schedule of the parish. */
  otherScheduleDayIds?: Set<string>;
  eventPersonIds: Set<string>;
  includeUnavailable?: boolean;
}): Suggestion[] {
  const out: Suggestion[] = [];

  for (const person of people) {
    if (!person.active) continue;
    const available = availableIds.has(person.id);
    if (!available && !includeUnavailable) continue;

    const s = statsById.get(person.id) ?? EMPTY_STATS;
    const alreadyInEvent = eventPersonIds.has(person.id);
    const otherScheduleConflict =
      !alreadyInEvent && !!otherScheduleDayIds?.has(person.id);
    const sameDayConflict =
      !alreadyInEvent && (sameDayIds.has(person.id) || otherScheduleConflict);

    let score = 100;
    const reasons: SuggestionReason[] = [];

    // Balance within the month - the dominant weight.
    score -= s.monthCount * 14;
    reasons.push(
      s.monthCount === 0
        ? { code: "noneThisMonth" }
        : { code: "timesThisMonth", values: { count: s.monthCount } },
    );

    // Recent history, lighter weight.
    score -= s.recentCount * 3;

    // Whoever has been away a while rises; whoever served yesterday drops.
    if (s.daysSinceLast === null) {
      score += 18;
      reasons.push({ code: "neverServed" });
    } else if (s.daysSinceLast > 45) {
      score += 12;
      reasons.push({ code: "lastServedDaysAgo", values: { days: s.daysSinceLast } });
    } else if (s.daysSinceLast <= 7) {
      score -= 8;
    }

    // Affinity with the location - a light tie-breaker.
    if (s.locationCount > 0) {
      score += Math.min(s.locationCount, 5) * 2;
      reasons.push({ code: "servedHereTimes", values: { count: s.locationCount } });
    } else {
      reasons.push({ code: "neverServedHere" });
    }

    // Whoever gave few dates has less chance of being used later: make the
    // most of them while it is possible.
    if (available && s.availabilityCount > 0 && s.availabilityCount <= 3) {
      score += 10;
      reasons.push({ code: "fewDatesGiven" });
    }

    if (!available) {
      score -= 200;
      reasons.unshift({ code: "noAvailability" });
    }
    if (sameDayConflict) {
      score -= 400;
      reasons.unshift({
        code: otherScheduleConflict ? "busyOnOtherSchedule" : "busySameDay",
      });
    }
    if (alreadyInEvent) {
      score -= 1000;
      reasons.unshift({ code: "alreadyInEvent" });
    }

    out.push({
      person,
      score,
      available,
      sameDayConflict,
      otherScheduleConflict,
      alreadyInEvent,
      reasons,
    });
  }

  return out.sort(
    (a, b) => b.score - a.score || byName.compare(a.person.full_name, b.person.full_name),
  );
}

/**
 * Fills a celebration's empty slots in one go with the best candidates. The
 * coordinator reviews afterwards - it is a shortcut, not automation.
 */
export function autoFillEvent({
  suggestions,
  emptyPositions,
}: {
  suggestions: Suggestion[];
  emptyPositions: number[];
}): Array<{ position: number; personId: string }> {
  const picks: Array<{ position: number; personId: string }> = [];
  const used = new Set<string>();

  for (const position of emptyPositions) {
    const next = suggestions.find(
      (s) =>
        s.available &&
        !s.alreadyInEvent &&
        !s.sameDayConflict &&
        !used.has(s.person.id),
    );
    if (!next) break;
    used.add(next.person.id);
    picks.push({ position, personId: next.person.id });
  }

  return picks;
}
