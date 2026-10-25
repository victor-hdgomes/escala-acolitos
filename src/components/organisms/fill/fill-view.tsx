"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Check,
  CheckCheck,
  Church,
  Clock,
  Filter,
  Loader2,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  claimDirectSlotAction,
  releaseDirectSlotAction,
  setAvailabilityAction,
} from "@/app/e/[token]/actions";
import {
  PersonButton,
  PersonPicker,
  type PickablePerson,
} from "@/components/organisms/fill/person-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useResultError } from "@/hooks/use-error-message";
import type { EventKind, SignupMode } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export interface FillEvent {
  id: string;
  dayKey: string;
  timeLabel: string;
  weekday: number;
  period: "morning" | "afternoon" | "night";
  locationId: string;
  locationName: string;
  locationShort: string;
  locationColor: string;
  label: string | null;
  kind: EventKind;
  signupMode: SignupMode;
  slots: number;
  takenNames: Array<string | null>;
  takenIds: Array<string | null>;
  availableCount: number;
  isPast: boolean;
}

export interface FillDay {
  key: string;
  title: string;
  weekdayLabel: string;
  eventIds: string[];
}

type QuickFilter =
  | "sunday"
  | "saturday"
  | "weekday"
  | "morning"
  | "night"
  | "novena";

/**
 * The chips live on different dimensions, and that changes how they combine:
 * OR within the same dimension, AND across dimensions. "Sundays + Saturdays"
 * shows both (same dimension); "Sundays + Morning" shows only Sunday mornings
 * (different dimensions), which is how the phrase sounds when read out loud.
 */
type FilterDimension = "day" | "time" | "kind";

const QUICK_FILTERS: Array<{ id: QuickFilter; dimension: FilterDimension }> = [
  { id: "sunday", dimension: "day" },
  { id: "saturday", dimension: "day" },
  { id: "weekday", dimension: "day" },
  { id: "morning", dimension: "time" },
  { id: "night", dimension: "time" },
  { id: "novena", dimension: "kind" },
];

const DIMENSION_OF = new Map(QUICK_FILTERS.map((f) => [f.id, f.dimension]));

const STORAGE_PREFIX = "fill:person:";

function matchesFilter(event: FillEvent, filter: QuickFilter): boolean {
  switch (filter) {
    case "sunday":
      return event.weekday === 0;
    case "saturday":
      return event.weekday === 6;
    case "weekday":
      return event.weekday > 0 && event.weekday < 6;
    case "morning":
      return event.period === "morning";
    case "night":
      return event.period === "night";
    case "novena":
      return event.kind === "novena";
  }
}

function matchesQuick(event: FillEvent, filters: Set<QuickFilter>): boolean {
  if (filters.size === 0) return true;

  const byDimension = new Map<FilterDimension, QuickFilter[]>();
  for (const f of filters) {
    const dimension = DIMENSION_OF.get(f)!;
    const list = byDimension.get(dimension) ?? [];
    list.push(f);
    byDimension.set(dimension, list);
  }

  for (const chosen of byDimension.values()) {
    if (!chosen.some((f) => matchesFilter(event, f))) return false;
  }
  return true;
}

export function FillView({
  token,
  parishName,
  title,
  introNote,
  deadlineLabel,
  open,
  closedReason,
  days,
  events,
  locations,
  people,
  availabilityByPerson,
  todayKey,
}: {
  token: string;
  parishName: string;
  title: string;
  introNote: string | null;
  deadlineLabel: string | null;
  open: boolean;
  closedReason: "deadline" | "status" | null;
  days: FillDay[];
  events: FillEvent[];
  locations: Array<{ id: string; name: string; color: string }>;
  people: PickablePerson[];
  availabilityByPerson: Record<string, string[]>;
  todayKey: string;
}) {
  const router = useRouter();
  const t = useTranslations("fill");
  const tCommon = useTranslations("common");
  const resultError = useResultError();
  // Someone signed in under a linked name starts out already identified.
  const linkedPerson = people.find((p) => p.isMe) ?? null;
  const [person, setPerson] = React.useState<PickablePerson | null>(linkedPerson);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [marked, setMarked] = React.useState<Set<string>>(
    () => new Set(linkedPerson ? (availabilityByPerson[linkedPerson.id] ?? []) : []),
  );
  const [quick, setQuick] = React.useState<Set<QuickFilter>>(new Set());
  const [locationFilter, setLocationFilter] = React.useState<Set<string>>(
    new Set(),
  );
  const [busy, setBusy] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);

  /** Switching names reloads that person's marks and remembers the device. */
  const choosePerson = React.useCallback(
    (next: PickablePerson) => {
      setPerson(next);
      setMarked(new Set(availabilityByPerson[next.id] ?? []));
      try {
        localStorage.setItem(STORAGE_PREFIX + token, next.id);
      } catch {
        // Private window or storage blocked - carry on without remembering.
      }
    },
    [availabilityByPerson, token],
  );

  // localStorage does not exist on the server, so it can only be read after
  // mounting - reading it during render would break hydration.
  React.useEffect(() => {
    if (person) return;
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + token);
      const found = stored ? people.find((p) => p.id === stored) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is an external system
      if (found && !(found.claimed && !found.isMe)) choosePerson(found);
      else setPickerOpen(true);
    } catch {
      setPickerOpen(true);
    }
    // Mount only: from here on the user's choice is what decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventById = React.useMemo(
    () => new Map(events.map((e) => [e.id, e])),
    [events],
  );

  const visibleIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (locationFilter.size && !locationFilter.has(e.locationId)) continue;
      if (!matchesQuick(e, quick)) continue;
      set.add(e.id);
    }
    return set;
  }, [events, quick, locationFilter]);

  const visibleDays = days
    .map((d) => ({ ...d, eventIds: d.eventIds.filter((id) => visibleIds.has(id)) }))
    .filter((d) => d.eventIds.length);

  // Batch marking only makes sense for what the coordinator will assign.
  const batchIds = [...visibleIds].filter(
    (id) => eventById.get(id)?.signupMode === "availability",
  );
  const allBatchMarked =
    batchIds.length > 0 && batchIds.every((id) => marked.has(id));

  const filtersActive = quick.size + locationFilter.size;

  async function toggle(eventId: string) {
    if (!person || !open) return;
    const next = !marked.has(eventId);

    setMarked((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(eventId);
      else copy.delete(eventId);
      return copy;
    });

    const res = await setAvailabilityAction({
      token,
      personId: person.id,
      eventIds: [eventId],
      value: next,
    });
    const message = resultError(res);
    if (message) {
      setMarked((prev) => {
        const copy = new Set(prev);
        if (next) copy.delete(eventId);
        else copy.add(eventId);
        return copy;
      });
      toast.error(message);
    }
  }

  async function applyBatch(value: boolean) {
    if (!person || !open || !batchIds.length) return;
    setBusy(true);
    const previous = new Set(marked);

    setMarked((prev) => {
      const copy = new Set(prev);
      for (const id of batchIds) {
        if (value) copy.add(id);
        else copy.delete(id);
      }
      return copy;
    });

    const res = await setAvailabilityAction({
      token,
      personId: person.id,
      eventIds: batchIds,
      value,
    });
    setBusy(false);

    const message = resultError(res);
    if (message) {
      setMarked(previous);
      toast.error(message);
    } else {
      toast.success(
        value
          ? t("toast.marked", { count: batchIds.length })
          : t("toast.unmarked"),
      );
    }
  }

  async function claimSlot(event: FillEvent, position: number) {
    if (!person || !open) return;
    setBusy(true);
    const res = await claimDirectSlotAction({
      token,
      personId: person.id,
      eventId: event.id,
      position,
    });
    setBusy(false);
    const message = resultError(res);
    if (message) toast.error(message);
    else {
      toast.success(t("toast.slotTaken"));
      router.refresh();
    }
  }

  async function releaseSlot(event: FillEvent) {
    if (!person || !open) return;
    setBusy(true);
    const res = await releaseDirectSlotAction({
      token,
      personId: person.id,
      eventId: event.id,
    });
    setBusy(false);
    const message = resultError(res);
    if (message) toast.error(message);
    else {
      toast.success(t("toast.slotReleased"));
      router.refresh();
    }
  }

  const markedCount = marked.size;

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Church className="h-4 w-4 shrink-0 text-primary" />
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {parishName}
            </p>
          </div>
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {title}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        {!open ? (
          <Alert variant="destructive">
            <AlertDescription>
              {closedReason !== "deadline"
                ? t("closed.status")
                : deadlineLabel
                  ? t("closed.deadlineOn", { date: deadlineLabel })
                  : t("closed.deadline")}
            </AlertDescription>
          </Alert>
        ) : null}

        {introNote ? (
          <Alert>
            <AlertDescription className="whitespace-pre-line">
              {introNote}
            </AlertDescription>
          </Alert>
        ) : null}

        {open && deadlineLabel ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {t.rich("deadlineNotice", {
              date: deadlineLabel,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        ) : null}

        <PersonButton person={person} onClick={() => setPickerOpen(true)} />

        {person ? (
          <>
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => setShowFilters((v) => !v)}
              >
                <Filter className="h-4 w-4" />
                {t("filters.toggle")}
                {filtersActive ? (
                  <Badge variant="secondary">{filtersActive}</Badge>
                ) : null}
              </Button>

              {showFilters ? (
                <Card>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex flex-wrap gap-2">
                      {QUICK_FILTERS.map((f) => (
                        <FilterChip
                          key={f.id}
                          label={t(`filters.${f.id}`)}
                          active={quick.has(f.id)}
                          onClick={() =>
                            setQuick((prev) => toggleSet(prev, f.id))
                          }
                        />
                      ))}
                    </div>
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      {locations.map((loc) => (
                        <FilterChip
                          key={loc.id}
                          label={loc.name}
                          color={loc.color}
                          active={locationFilter.has(loc.id)}
                          onClick={() =>
                            setLocationFilter((prev) => toggleSet(prev, loc.id))
                          }
                        />
                      ))}
                    </div>
                    {filtersActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setQuick(new Set());
                          setLocationFilter(new Set());
                        }}
                      >
                        <X className="h-4 w-4" />
                        {t("filters.clear")}
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              {open && batchIds.length > 1 ? (
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  disabled={busy}
                  onClick={() => applyBatch(!allBatchMarked)}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4" />
                  )}
                  {allBatchMarked
                    ? t("batch.unmark", { count: batchIds.length })
                    : filtersActive
                      ? t("batch.markFiltered", { count: batchIds.length })
                      : t("batch.markAll", { count: batchIds.length })}
                </Button>
              ) : null}
            </div>

            <div className="space-y-5">
              {visibleDays.map((day) => (
                <section key={day.key}>
                  <div className="mb-2 flex items-baseline gap-2">
                    <h2 className="text-sm font-semibold">{day.title}</h2>
                    <span className="text-xs text-muted-foreground">
                      {day.weekdayLabel}
                    </span>
                    {day.key === todayKey ? (
                      <Badge variant="secondary">{tCommon("today")}</Badge>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {day.eventIds.map((id) => {
                      const event = eventById.get(id)!;
                      return event.signupMode === "direct" ? (
                        <DirectEventCard
                          key={id}
                          event={event}
                          personId={person.id}
                          disabled={!open || busy}
                          onClaim={(pos) => claimSlot(event, pos)}
                          onRelease={() => releaseSlot(event)}
                        />
                      ) : (
                        <AvailabilityRow
                          key={id}
                          event={event}
                          checked={marked.has(id)}
                          disabled={!open}
                          onToggle={() => toggle(id)}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}

              {visibleDays.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {t("emptyFiltered")}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("chooseNamePrompt")}
          </p>
        )}
      </div>

      {person ? (
        <footer className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <Sparkles className="h-4 w-4 shrink-0 text-[color:var(--color-filled)]" />
            <p className="min-w-0 flex-1 text-sm">
              {t.rich("markedCount", {
                count: markedCount,
                strong: (chunks) => (
                  <strong className="tabular-nums">{chunks}</strong>
                ),
              })}
              <span className="ml-2 text-xs text-muted-foreground">
                {t("autosaved")}
              </span>
            </p>
          </div>
        </footer>
      ) : null}

      <PersonPicker
        people={people}
        value={person}
        onChange={choosePerson}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </div>
  );
}

function toggleSet<T>(prev: Set<T>, value: T): Set<T> {
  const copy = new Set(prev);
  if (copy.has(value)) copy.delete(value);
  else copy.add(value);
  return copy;
}

function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      {color ? (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      ) : null}
      {label}
    </button>
  );
}

function AvailabilityRow({
  event,
  checked,
  disabled,
  onToggle,
}: {
  event: FillEvent;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "tap-target flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        checked
          ? "border-[color:var(--color-filled)] bg-[color:var(--color-filled)]/10"
          : "border-border hover:bg-accent",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
          checked
            ? "border-[color:var(--color-filled)] bg-[color:var(--color-filled)] text-[color:var(--color-filled-foreground)]"
            : "border-input",
        )}
        aria-hidden
      >
        {checked ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
      <span className="w-14 shrink-0 text-sm font-medium tabular-nums">
        {event.timeLabel}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{event.locationName}</span>
        {event.label ? (
          <span className="block truncate text-xs text-muted-foreground">
            {event.label}
          </span>
        ) : null}
      </span>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: event.locationColor }}
        aria-hidden
      />
    </button>
  );
}

/**
 * A direct-signup celebration (novena): shows the numbered slots, just like
 * the message the group already uses. Tapping an empty slot takes it.
 */
function DirectEventCard({
  event,
  personId,
  disabled,
  onClaim,
  onRelease,
}: {
  event: FillEvent;
  personId: string;
  disabled: boolean;
  onClaim: (position: number) => void;
  onRelease: () => void;
}) {
  const t = useTranslations("fill");
  const mine = event.takenIds.findIndex((id) => id === personId);

  return (
    <div className="rounded-lg border border-[color:var(--color-novena)]/40 bg-[color:var(--color-novena)]/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium tabular-nums">
          {event.timeLabel}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {event.label ?? event.locationName}
        </span>
        <Badge
          variant="secondary"
          className="bg-[color:var(--color-novena)]/15 text-[color:var(--color-novena)]"
        >
          {t("direct.badge")}
        </Badge>
      </div>
      <p className="mb-2 truncate text-xs text-muted-foreground">
        {event.locationName}
      </p>
      <div className="space-y-1.5">
        {Array.from({ length: event.slots }, (_, i) => {
          const position = i + 1;
          const name = event.takenNames[i];
          const isMine = event.takenIds[i] === personId;

          if (name) {
            return (
              <div
                key={position}
                className="tap-target flex items-center gap-2 rounded-md border border-border bg-background px-3 text-sm"
              >
                <span className="w-4 shrink-0 text-muted-foreground tabular-nums">
                  {position}
                </span>
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {isMine ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={onRelease}
                  >
                    {t("direct.leave")}
                  </Button>
                ) : (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            );
          }

          return (
            <button
              key={position}
              type="button"
              disabled={disabled || mine >= 0}
              onClick={() => onClaim(position)}
              className={cn(
                "tap-target flex w-full items-center gap-2 rounded-md border border-dashed border-input px-3 text-left text-sm text-muted-foreground",
                !disabled && mine < 0 && "hover:border-primary hover:text-foreground",
                (disabled || mine >= 0) && "opacity-60",
              )}
            >
              <span className="w-4 shrink-0 tabular-nums">{position}</span>
              <span>
                {mine >= 0 ? t("direct.openSlot") : t("direct.take")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
