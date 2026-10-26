"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarHeart, CalendarPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addNovenaAction,
  deleteEventAction,
  saveEventAction,
} from "@/app/(app)/schedules/actions";
import { ConfirmAction } from "@/components/molecules/confirm-action";
import { FormSelect } from "@/components/molecules/form-select";
import { SubmitButton } from "@/components/molecules/submit-button";
import { useDateFormatter } from "@/components/providers/timezone-provider";
import { useFormAction } from "@/hooks/use-form-action";
import { useResultError } from "@/hooks/use-error-message";
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
import { dayKey, zonedParts } from "@/lib/date";
import type { EventView, LocationLite } from "@/lib/schedule/types";

export function EventsTab({
  detail,
  locations,
  hasTemplates,
}: ScheduleViewProps) {
  const router = useRouter();
  const t = useTranslations("schedules");
  const tc = useTranslations("confirm");
  const df = useDateFormatter();
  const resultError = useResultError();
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
                    {df.time(event.starts_at)}
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
                      {t("badges.direct")}
                    </Badge>
                  ) : null}
                  <EventDialog
                    scheduleId={detail.schedule.id}
                    locations={locations}
                    timezone={detail.timezone}
                    defaultDay={monthStart}
                    event={event}
                  />
                  <ConfirmAction
                    title={tc("event.title")}
                    description={`${tc("event.body")} ${tc("cannotUndo")}`}
                    onConfirm={() =>
                      startTransition(async () => {
                        const res = await deleteEventAction(
                          event.id,
                          detail.schedule.id,
                        );
                        const message = resultError(res);
                        if (message) toast.error(message);
                        else router.refresh();
                      })
                    }
                    trigger={
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={pending}
                        aria-label={t("events.delete")}
                      >
                        <Trash2 className="h-4 w-4 text-[color:var(--color-open)]" />
                      </Button>
                    }
                  />
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>
      ))}

      {detail.days.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <CalendarPlus className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">{t("emptySchedule.title")}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-balance text-muted-foreground">
            {hasTemplates
              ? t("emptySchedule.bodyWithPattern")
              : t("emptySchedule.bodyNoPattern")}
          </p>
          <Button asChild variant="outline" className="tap-target mt-4">
            <Link href="/group?tab=templates">{t("emptySchedule.openPattern")}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "19:30" for an `<input type="time">`, which only ever accepts 24-hour text.
 *
 * Read off the parish's clock rather than through a formatter: the reader's
 * locale would turn the same instant into "7:30 PM" and the input would
 * silently reject it.
 */
function timeInputValue(iso: string, timeZone: string): string {
  const { hour, minute } = zonedParts(iso, timeZone);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Exported so an empty schedule can offer the real form, not a pointer to it. */
export function EventDialog({
  scheduleId,
  locations,
  timezone,
  defaultDay,
  event,
  addLabel,
}: {
  scheduleId: string;
  locations: LocationLite[];
  timezone: string;
  defaultDay: string;
  event?: EventView;
  addLabel?: string;
}) {
  const router = useRouter();
  const t = useTranslations("schedules");
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(saveEventAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const day = event ? dayKey(event.starts_at, timezone) : defaultDay;
  const time = event ? timeInputValue(event.starts_at, timezone) : "19:30";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {event ? (
          <Button size="icon" variant="ghost" aria-label={t("events.edit")}>
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" className="tap-target">
            <Plus className="h-4 w-4" />
            {addLabel ?? t("events.add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {event ? t("events.editTitle") : t("events.newTitle")}
          </DialogTitle>
          <DialogDescription>{t("events.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="scheduleId" value={scheduleId} />
          {event ? <input type="hidden" name="id" value={event.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="ev-location">{t("fields.location")}</Label>
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
              <Label htmlFor="ev-day">{t("fields.date")}</Label>
              <Input id="ev-day" name="day" type="date" defaultValue={day} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-time">{t("fields.time")}</Label>
              <Input
                id="ev-time"
                name="time"
                type="time"
                defaultValue={time}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-slots">{t("fields.slots")}</Label>
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
              <Label htmlFor="ev-kind">{t("fields.kind")}</Label>
              <FormSelect
                id="ev-kind"
                name="kind"
                defaultValue={event?.kind ?? "mass"}
                options={[
                  { value: "mass", label: t("events.kindMass") },
                  { value: "novena", label: t("events.kindNovena") },
                  { value: "special", label: t("events.kindSpecial") },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-mode">{t("fields.signupMode")}</Label>
              <FormSelect
                id="ev-mode"
                name="signupMode"
                defaultValue={event?.signup_mode ?? "availability"}
                options={[
                  { value: "availability", label: t("novena.modeCoordinator") },
                  { value: "direct", label: t("novena.modeDirect") },
                ]}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ev-label">{t("fields.descriptionOptional")}</Label>
            <Input
              id="ev-label"
              name="label"
              defaultValue={event?.label ?? ""}
              placeholder={t("events.labelPlaceholder")}
            />
          </div>

          <SubmitButton pending={pending} className="w-full">
            {t("save")}
          </SubmitButton>
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
  const t = useTranslations("schedules");
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(addNovenaAction, {
    onSuccess: () => {
      setOpen(false);
      toast.success(t("novena.created"));
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarHeart className="h-4 w-4" />
          {t("novena.add")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("novena.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("novena.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="scheduleId" value={scheduleId} />

          <div className="space-y-2">
            <Label htmlFor="nov-title">{t("fields.name")}</Label>
            <Input
              id="nov-title"
              name="title"
              placeholder={t("novena.namePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nov-location">{t("fields.location")}</Label>
            <FormSelect
              id="nov-location"
              name="locationId"
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nov-day">{t("fields.firstDay")}</Label>
              <Input
                id="nov-day"
                name="firstDay"
                type="date"
                defaultValue={defaultDay}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nov-time">{t("fields.time")}</Label>
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
              <Label htmlFor="nov-days">{t("fields.days")}</Label>
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
              <Label htmlFor="nov-slots">{t("fields.slotsPerDay")}</Label>
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

          <SubmitButton pending={pending} className="w-full">
            {t("novena.create")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
