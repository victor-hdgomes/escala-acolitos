"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarHeart, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addNovenaAction,
  deleteEventAction,
  saveEventAction,
} from "@/app/(app)/escalas/actions";
import { FormSelect } from "@/components/molecules/form-select";
import { SubmitButton } from "@/components/molecules/submit-button";
import { useFormAction } from "@/hooks/use-form-action";
import type { ScheduleViewProps } from "@/components/organisms/schedules/schedule-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { dayKey, formatTime } from "@/lib/date";
import type { EventView, LocationLite } from "@/lib/schedule/types";

export function EventsTab({ detail, locations }: ScheduleViewProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const monthStart = detail.schedule.month;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <EventDialog
          scheduleId={detail.schedule.id}
          locations={locations}
          timezone={detail.timezone}
          defaultDay={monthStart}
        />
        <NovenaDialog
          scheduleId={detail.schedule.id}
          locations={locations}
          defaultDay={monthStart}
        />
      </div>

      {detail.days.map((day) => (
        <section key={day.key}>
          <div className="mb-1 flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">{day.label}</h2>
            <span className="text-xs text-muted-foreground">{day.weekday}</span>
          </div>
          <div className="space-y-1">
            {day.events.map((event, i) => (
              <React.Fragment key={event.id}>
                {i > 0 ? <Separator /> : null}
                <div className="flex items-center gap-3 py-2">
                  <span className="w-14 shrink-0 text-sm tabular-nums">
                    {formatTime(event.starts_at, detail.timezone)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{event.location.name}</p>
                    {event.label ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {event.label}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="secondary">{event.slots}</Badge>
                  {event.signup_mode === "direct" ? (
                    <Badge
                      variant="secondary"
                      className="bg-[color:var(--color-novena)]/15 text-[color:var(--color-novena)]"
                    >
                      direto
                    </Badge>
                  ) : null}
                  <EventDialog
                    scheduleId={detail.schedule.id}
                    locations={locations}
                    timezone={detail.timezone}
                    defaultDay={monthStart}
                    event={event}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={pending}
                    aria-label="Excluir celebração"
                    onClick={() =>
                      startTransition(async () => {
                        const res = await deleteEventAction(
                          event.id,
                          detail.schedule.id,
                        );
                        if (!res.ok) toast.error(res.error);
                        else router.refresh();
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-[color:var(--color-open)]" />
                  </Button>
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>
      ))}

      {detail.days.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma celebração. Adicione uma, ou gere a partir da grade criando
          outra escala.
        </p>
      ) : null}
    </div>
  );
}

function EventDialog({
  scheduleId,
  locations,
  timezone,
  defaultDay,
  event,
}: {
  scheduleId: string;
  locations: LocationLite[];
  timezone: string;
  defaultDay: string;
  event?: EventView;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(saveEventAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  const day = event ? dayKey(event.starts_at, timezone) : defaultDay;
  const time = event
    ? formatTime(event.starts_at, timezone).replace("h", ":")
    : "19:30";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {event ? (
          <Button size="icon" variant="ghost" aria-label="Editar celebração">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Celebração
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {event ? "Editar celebração" : "Nova celebração"}
          </DialogTitle>
          <DialogDescription>
            Use &quot;direto&quot; quando a vaga for pegada pelo próprio acólito,
            como na novena.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="scheduleId" value={scheduleId} />
          {event ? <input type="hidden" name="id" value={event.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="ev-location">Local</Label>
            <FormSelect
              id="ev-location"
              name="locationId"
              defaultValue={event?.location.id}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ev-day">Data</Label>
              <Input id="ev-day" name="day" type="date" defaultValue={day} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-time">Hora</Label>
              <Input
                id="ev-time"
                name="time"
                type="time"
                defaultValue={time}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-slots">Vagas</Label>
              <Input
                id="ev-slots"
                name="slots"
                type="number"
                min={1}
                max={12}
                defaultValue={event?.slots ?? 4}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ev-kind">Tipo</Label>
              <FormSelect
                id="ev-kind"
                name="kind"
                defaultValue={event?.kind ?? "mass"}
                options={[
                  { value: "mass", label: "Missa" },
                  { value: "novena", label: "Novena" },
                  { value: "special", label: "Celebração especial" },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-mode">Preenchimento</Label>
              <FormSelect
                id="ev-mode"
                name="signupMode"
                defaultValue={event?.signup_mode ?? "availability"}
                options={[
                  { value: "availability", label: "Coordenador escala" },
                  { value: "direct", label: "Acólito pega a vaga" },
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ev-label">Descrição (opcional)</Label>
            <Input
              id="ev-label"
              name="label"
              defaultValue={event?.label ?? ""}
              placeholder="Solenidade de Cristo Rei"
            />
          </div>

          <SubmitButton pending={pending} className="w-full">Salvar</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NovenaDialog({
  scheduleId,
  locations,
  defaultDay,
}: {
  scheduleId: string;
  locations: LocationLite[];
  defaultDay: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(addNovenaAction, {
    onSuccess: () => {
      setOpen(false);
      toast.success("Novena criada");
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarHeart className="h-4 w-4" />
          Novena
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova novena</DialogTitle>
          <DialogDescription>
            Cria os dias seguidos de uma vez, com vagas numeradas que o próprio
            acólito pega — igual à mensagem do grupo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="scheduleId" value={scheduleId} />

          <div className="space-y-2">
            <Label htmlFor="nov-title">Nome</Label>
            <Input
              id="nov-title"
              name="title"
              placeholder="Novena em honra a Nossa Senhora Aparecida"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nov-location">Local</Label>
            <FormSelect
              id="nov-location"
              name="locationId"
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nov-day">Primeiro dia</Label>
              <Input
                id="nov-day"
                name="firstDay"
                type="date"
                defaultValue={defaultDay}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nov-time">Hora</Label>
              <Input
                id="nov-time"
                name="time"
                type="time"
                defaultValue="19:30"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nov-days">Dias</Label>
              <Input
                id="nov-days"
                name="days"
                type="number"
                min={1}
                max={31}
                defaultValue={9}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nov-slots">Vagas por dia</Label>
              <Input
                id="nov-slots"
                name="slots"
                type="number"
                min={1}
                max={12}
                defaultValue={2}
              />
            </div>
          </div>

          <SubmitButton pending={pending} className="w-full">Criar novena</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
