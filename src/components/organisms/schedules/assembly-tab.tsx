"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CalendarPlus,
  Loader2,
  Plus,
  Search,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { assignAction, autoFillEventAction } from "@/app/(app)/schedules/actions";
import { EventDialog } from "@/components/organisms/schedules/events-tab";
import type { ScheduleViewProps } from "@/components/organisms/schedules/schedule-detail";
import { useDateFormatter } from "@/components/providers/timezone-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useResultError } from "@/hooks/use-error-message";
import { rankCandidates, type Suggestion } from "@/lib/schedule/suggest";
import type { EventView } from "@/lib/schedule/types";
import { cn } from "@/lib/utils";

interface OpenSlot {
  event: EventView;
  dayKey: string;
  position: number;
}

export function AssemblyTab({
  detail,
  people,
  locations,
  stats,
  locationCounts,
  busyByDay,
  hasTemplates,
}: ScheduleViewProps) {
  const router = useRouter();
  const t = useTranslations("schedules");
  const df = useDateFormatter();
  const resultError = useResultError();
  const [slot, setSlot] = React.useState<OpenSlot | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [onlyIncomplete, setOnlyIncomplete] = React.useState(false);

  const days = React.useMemo(
    () =>
      detail.days
        .map((d) => ({
          ...d,
          events: onlyIncomplete
            ? d.events.filter((e) => e.slotsView.some((s) => !s.person))
            : d.events,
        }))
        .filter((d) => d.events.length),
    [detail.days, onlyIncomplete],
  );

  // Assembly needs both sides: celebrations to fill and altar servers to put in
  // them. Either one missing is a dead end the coordinator cannot leave from
  // this tab, so each says where to go.
  const hasEvents = detail.days.some((d) => d.events.length > 0);
  const hasPeople = people.some((p) => p.active);

  const autoFill = (event: EventView) =>
    startTransition(async () => {
      const res = await autoFillEventAction(event.id, detail.schedule.id);
      const message = resultError(res);
      if (message) {
        toast.error(message);
        return;
      }
      toast.success(
        t("assembly.autoFillResult", {
          count: res.ok ? (res.data?.filled ?? 0) : 0,
        }),
      );
      router.refresh();
    });

  const clearSlot = (event: EventView, position: number) =>
    startTransition(async () => {
      const res = await assignAction({
        eventId: event.id,
        position,
        personId: null,
        scheduleId: detail.schedule.id,
      });
      const message = resultError(res);
      if (message) toast.error(message);
      else router.refresh();
    });

  return (
    <div className="space-y-4">
      {hasEvents ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={onlyIncomplete} onCheckedChange={setOnlyIncomplete} />
          {t("assembly.onlyIncomplete")}
        </label>
      ) : null}

      {!hasEvents ? (
        <EmptyNotice
          icon={CalendarPlus}
          title={t("emptySchedule.title")}
          body={
            hasTemplates
              ? t("emptySchedule.bodyWithPattern")
              : t("emptySchedule.bodyNoPattern")
          }
        >
          {/* Offered only once there is somewhere to celebrate. The dialog's
              place picker is a required hidden input, so with no places it
              cannot be filled and the browser refuses to submit, silently. */}
          {locations.length ? (
            <EventDialog
              scheduleId={detail.schedule.id}
              locations={locations}
              timezone={detail.timezone}
              defaultDay={detail.schedule.month}
              addLabel={t("emptySchedule.addEvent")}
            />
          ) : null}
          <Button asChild variant="outline" className="tap-target">
            <Link href={locations.length ? "/group?tab=templates" : "/group?tab=locations"}>
              {t("emptySchedule.openPattern")}
            </Link>
          </Button>
        </EmptyNotice>
      ) : null}

      {!hasPeople ? (
        <EmptyNotice
          icon={UserPlus}
          title={t("emptyPeople.title")}
          body={t("emptyPeople.body")}
        >
          <Button asChild className="tap-target">
            <Link href="/people">{t("setup.peopleAction")}</Link>
          </Button>
        </EmptyNotice>
      ) : null}

      {days.map((day) => (
        <section key={day.key}>
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">{day.label}</h2>
            <span className="text-xs text-muted-foreground">{day.weekday}</span>
          </div>

          <div className="space-y-3">
            {day.events.map((event) => {
              const empty = event.slotsView.filter((s) => !s.person).length;
              // In direct sign-up nobody marks availability - the candidate
              // count is always zero and the warning would be noise.
              const shortOnCandidates =
                event.signup_mode === "availability" &&
                event.availablePeople.length < event.slots;

              return (
                <div
                  key={event.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: event.location.color }}
                      aria-hidden
                    />
                    <span className="text-sm font-medium tabular-nums">
                      {df.time(event.starts_at)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {event.location.name}
                    </span>
                    {event.signup_mode === "direct" ? (
                      <Badge
                        variant="secondary"
                        className="bg-[color:var(--color-novena)]/15 text-[color:var(--color-novena)]"
                      >
                        {t("badges.direct")}
                      </Badge>
                    ) : null}
                    <Badge
                      variant="secondary"
                      className="gap-1"
                      title={
                        event.signup_mode === "direct"
                          ? t("assembly.tookSlotTooltip")
                          : t("assembly.availableTooltip")
                      }
                    >
                      <Users className="h-3 w-3" />
                      {event.signup_mode === "direct"
                        ? event.slotsView.filter((s) => s.person).length
                        : event.availablePeople.length}
                    </Badge>
                  </div>

                  {event.label ? (
                    <p className="mb-2 truncate text-xs text-muted-foreground">
                      {event.label}
                    </p>
                  ) : null}

                  {shortOnCandidates && empty > 0 ? (
                    <p className="mb-2 flex items-center gap-1.5 text-xs text-[color:var(--color-pending)]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t("assembly.shortOnCandidates")}
                    </p>
                  ) : null}

                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {event.slotsView.map((s) => (
                      <div
                        key={s.position}
                        className={cn(
                          "tap-target flex items-center gap-2 rounded-md border px-2 text-sm",
                          s.person
                            ? "border-[color:var(--color-filled)]/40 bg-[color:var(--color-filled)]/5"
                            : "border-dashed border-input",
                        )}
                      >
                        <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                          {s.position}
                        </span>
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate py-2 text-left"
                          onClick={() =>
                            setSlot({
                              event,
                              dayKey: day.key,
                              position: s.position,
                            })
                          }
                        >
                          {s.person ? (
                            <span className="flex items-center gap-1.5">
                              <span className="truncate">
                                {s.person.short_name ?? s.person.full_name}
                              </span>
                              {s.swap ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-[color:var(--color-pending)]/15 text-[color:var(--color-pending)]"
                                >
                                  {t("badges.swap")}
                                </Badge>
                              ) : null}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Plus className="h-3.5 w-3.5" />
                              {t("assembly.openSlot")}
                            </span>
                          )}
                        </button>
                        {s.person ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={pending}
                            aria-label={t("assembly.clearSlot")}
                            onClick={() => clearSlot(event, s.position)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {empty > 0 && event.signup_mode === "availability" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 gap-2"
                      disabled={pending}
                      onClick={() => autoFill(event)}
                    >
                      {pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                      {t("assembly.suggestFill", { count: empty })}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {hasEvents && days.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("assembly.allFilled")}
        </p>
      ) : null}

      <SlotPicker
        slot={slot}
        onClose={() => setSlot(null)}
        detail={detail}
        people={people}
        stats={stats}
        locationCounts={locationCounts}
        busyByDay={busyByDay}
      />
    </div>
  );
}

function EmptyNotice({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center">
      <Icon className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-balance text-muted-foreground">
        {body}
      </p>
      <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        {children}
      </div>
    </div>
  );
}

/**
 * The panel's shell. The Sheet stays mounted the whole time and only toggles
 * `open`.
 *
 * Remounting it on open (via key) made the panel close by itself: the click
 * that opens it is still in flight, and the `pointerup` lands after the mount -
 * Radix reads that as a click outside and closes. So the key sits on the body,
 * which is what has to start clean for each slot.
 */
function SlotPicker({
  slot,
  onClose,
  detail,
  people,
  stats,
  locationCounts,
  busyByDay,
}: {
  slot: OpenSlot | null;
  onClose: () => void;
  detail: ScheduleViewProps["detail"];
  people: ScheduleViewProps["people"];
  stats: ScheduleViewProps["stats"];
  locationCounts: ScheduleViewProps["locationCounts"];
  busyByDay: ScheduleViewProps["busyByDay"];
}) {
  return (
    <Sheet open={!!slot} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0">
        {slot ? (
          <SlotPickerBody
            key={`${slot.event.id}:${slot.position}`}
            slot={slot}
            onClose={onClose}
            detail={detail}
            people={people}
            stats={stats}
            locationCounts={locationCounts}
            busyByDay={busyByDay}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SlotPickerBody({
  slot,
  onClose,
  detail,
  people,
  stats,
  locationCounts,
  busyByDay,
}: {
  slot: OpenSlot;
  onClose: () => void;
  detail: ScheduleViewProps["detail"];
  people: ScheduleViewProps["people"];
  stats: ScheduleViewProps["stats"];
  locationCounts: ScheduleViewProps["locationCounts"];
  busyByDay: ScheduleViewProps["busyByDay"];
}) {
  const router = useRouter();
  const t = useTranslations("schedules");
  const resultError = useResultError();
  const [query, setQuery] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const suggestions = React.useMemo<Suggestion[]>(() => {
    const { event } = slot;

    // `locationCount` is per place; only here is the slot's place known.
    const statsById = new Map(
      Object.entries(stats).map(([personId, value]) => [
        personId,
        {
          ...value,
          locationCount: locationCounts[personId]?.[event.location.id] ?? 0,
        },
      ]),
    );

    const day = detail.days.find((d) => d.key === slot.dayKey);
    const sameDayIds = new Set(
      (day?.events ?? [])
        .filter((e) => e.id !== event.id)
        .flatMap((e) => e.slotsView.map((s) => s.person?.id))
        .filter((id): id is string => !!id),
    );

    return rankCandidates({
      people,
      statsById,
      availableIds: new Set(event.availablePeople.map((p) => p.id)),
      sameDayIds,
      otherScheduleDayIds: new Set(busyByDay[slot.dayKey] ?? []),
      eventPersonIds: new Set(
        event.slotsView
          .map((s) => s.person?.id)
          .filter((id): id is string => !!id),
      ),
      includeUnavailable: showAll,
    });
  }, [slot, people, stats, locationCounts, detail.days, showAll, busyByDay]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!q) return suggestions;
    return suggestions.filter((s) =>
      s.person.full_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .includes(q),
    );
  }, [suggestions, query]);

  const pick = (personId: string) => {
    startTransition(async () => {
      const res = await assignAction({
        eventId: slot.event.id,
        position: slot.position,
        personId,
        scheduleId: detail.schedule.id,
      });
      const message = resultError(res);
      if (message) {
        toast.error(message);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  const noneSelectable =
    !showAll && filtered.length > 0 && filtered.every((s) => s.alreadyInEvent);

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="px-4 pt-4 pb-2">
        <SheetTitle>
          {t("assembly.slotTitle", {
            location: slot.event.location.name,
            position: slot.position,
          })}
        </SheetTitle>
        <SheetDescription>{t("assembly.pickerHint")}</SheetDescription>
      </SheetHeader>

      <div className="space-y-2 px-4 pb-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("assembly.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={showAll} onCheckedChange={setShowAll} />
          {t("assembly.showAll")}
        </label>
      </div>

      <div className="flex-1 overflow-y-auto border-t border-border">
        {filtered.map((s) => (
          <button
            key={s.person.id}
            type="button"
            disabled={pending || s.alreadyInEvent}
            onClick={() => pick(s.person.id)}
            className={cn(
              "tap-target flex w-full items-center gap-3 border-b border-border px-4 py-2 text-left",
              s.alreadyInEvent
                ? "cursor-not-allowed opacity-40"
                : "hover:bg-accent",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {s.person.full_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {s.reasons.slice(0, 3).join(" · ")}
              </p>
            </div>
            {s.sameDayConflict ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-[color:var(--color-pending)]" />
            ) : null}
            {!s.available ? (
              <Badge variant="secondary">{t("badges.unavailable")}</Badge>
            ) : null}
          </button>
        ))}

        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {showAll ? t("assembly.noMatches") : t("assembly.noneAvailable")}
          </p>
        ) : noneSelectable ? (
          // A list full of greyed-out names with no explanation is a dead end:
          // here the coordinator needs to know the way through is to override
          // availability.
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t("assembly.allAvailableAssigned")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
