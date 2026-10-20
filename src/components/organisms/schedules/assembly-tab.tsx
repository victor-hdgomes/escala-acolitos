"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  Plus,
  Search,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { assignAction, autoFillEventAction } from "@/app/(app)/escalas/actions";
import type { ScheduleViewProps } from "@/components/organisms/schedules/schedule-detail";
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
import { formatTime } from "@/lib/date";
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
  stats,
  locationCounts,
  busyByDay,
}: ScheduleViewProps) {
  const router = useRouter();
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

  const autoFill = (event: EventView) =>
    startTransition(async () => {
      const res = await autoFillEventAction(event.id, detail.schedule.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data?.filled
          ? `${res.data.filled} ${res.data.filled === 1 ? "vaga preenchida" : "vagas preenchidas"}`
          : "Ninguém disponível para as vagas livres",
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
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={onlyIncomplete} onCheckedChange={setOnlyIncomplete} />
        Só celebrações com vaga livre
      </label>

      {days.map((day) => (
        <section key={day.key}>
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">{day.label}</h2>
            <span className="text-xs text-muted-foreground">{day.weekday}</span>
          </div>

          <div className="space-y-3">
            {day.events.map((event) => {
              const empty = event.slotsView.filter((s) => !s.person).length;
              // Em preenchimento direto ninguém marca disponibilidade — o
              // contador de candidatos é sempre zero e o alerta seria ruído.
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
                      {formatTime(event.starts_at, detail.timezone)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {event.location.name}
                    </span>
                    {event.signup_mode === "direct" ? (
                      <Badge
                        variant="secondary"
                        className="bg-[color:var(--color-novena)]/15 text-[color:var(--color-novena)]"
                      >
                        direto
                      </Badge>
                    ) : null}
                    <Badge
                      variant="secondary"
                      className="gap-1"
                      title={
                        event.signup_mode === "direct"
                          ? "Quem já pegou vaga"
                          : "Quem marcou disponibilidade"
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
                      Menos candidatos que vagas
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
                                  troca
                                </Badge>
                              ) : null}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Plus className="h-3.5 w-3.5" />
                              vaga livre
                            </span>
                          )}
                        </button>
                        {s.person ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={pending}
                            aria-label="Tirar da vaga"
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
                      {empty === 1
                        ? "Sugerir para a vaga livre"
                        : `Sugerir para as ${empty} vagas livres`}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {days.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {onlyIncomplete
            ? "Tudo preenchido. 🎉"
            : "Nenhuma celebração nesta escala."}
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

/**
 * A casca do painel. O Sheet fica montado o tempo todo e só alterna `open`.
 *
 * Remontá-lo ao abrir (via key) fazia o painel fechar sozinho: o clique que o
 * abre ainda está em curso, e o `pointerup` chega depois da montagem — o Radix
 * o lê como clique fora e fecha. Por isso a key fica no corpo, que é quem
 * precisa nascer limpo a cada vaga.
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
  const [query, setQuery] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const suggestions = React.useMemo<Suggestion[]>(() => {
    const { event } = slot;

    // `locationCount` é por local; só aqui se sabe qual é o local da vaga.
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
      if (!res.ok) {
        toast.error(res.error);
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
          {slot.event.location.name} · vaga {slot.position}
        </SheetTitle>
        <SheetDescription>
          Ordenado por quem está em falta de escala. A escolha é sua.
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-2 px-4 pb-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nome"
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={showAll} onCheckedChange={setShowAll} />
          Mostrar quem não marcou disponibilidade
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
            {!s.available ? <Badge variant="secondary">fora</Badge> : null}
          </button>
        ))}

        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {showAll
              ? "Nenhum nome encontrado."
              : "Ninguém marcou disponibilidade. Ative a opção acima para ver todos."}
          </p>
        ) : noneSelectable ? (
          // Lista cheia de nomes cinzas sem explicação é um beco: aqui o
          // coordenador precisa saber que o caminho é furar a disponibilidade.
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Todos os que marcaram disponibilidade já estão nesta celebração.
            Ative a opção acima para escalar alguém do grupo mesmo assim.
          </p>
        ) : null}
      </div>
    </div>
  );
}
