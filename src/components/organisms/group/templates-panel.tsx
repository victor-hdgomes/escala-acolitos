"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTemplateAction,
  saveTemplateAction,
} from "@/app/(app)/group/actions";
import { FormSelect } from "@/components/molecules/form-select";
import { SubmitButton } from "@/components/molecules/submit-button";
import {
  useDateFormatter,
  useTimeZone,
} from "@/components/providers/timezone-provider";
import { useResultError } from "@/hooks/use-error-message";
import { useFormAction } from "@/hooks/use-form-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { parseTimeOfDay, zonedParts, zonedTimeToUtc } from "@/lib/date";
import type { Location, MassTemplate } from "@/lib/db/types";
import { nowDate } from "@/lib/now";

/** Time a new Mass is pre-filled with - the commonest evening slot. */
const DEFAULT_START_TIME = "19:30";

/** Slots a new Mass is pre-filled with, and the ceiling the schema enforces. */
const DEFAULT_SLOTS = 4;
const MAX_SLOTS = 12;

/** Weekday names in the reader's language, Sunday first. */
function useWeekdayNames() {
  const df = useDateFormatter();
  // Sunday first, matching how `mass_templates.weekday` is stored.
  return React.useMemo(() => df.weekdayNames("long"), [df]);
}

/**
 * Renders `mass_templates.start_time` ("19:30:00") in the reader's clock.
 *
 * The column is a bare wall-clock time with no date, and `Intl` only formats
 * instants - so the value is anchored to today in the parish's zone first.
 * That round trip is what lets the same row read "19:30" for one reader and
 * "7:30 PM" for another.
 */
function useClockFormatter() {
  const df = useDateFormatter();
  const timeZone = useTimeZone();

  return React.useCallback(
    (startTime: string) => {
      const { hour, minute } = parseTimeOfDay(startTime);
      const { year, month, day } = zonedParts(nowDate(), timeZone);
      return df.time(zonedTimeToUtc(year, month, day, hour, minute, timeZone));
    },
    [df, timeZone],
  );
}

export function TemplatesPanel({
  templates,
  locations,
}: {
  templates: MassTemplate[];
  locations: Location[];
}) {
  const router = useRouter();
  const t = useTranslations("group.templates");
  const weekdayNames = useWeekdayNames();
  const formatClock = useClockFormatter();
  const resultError = useResultError();
  const [pending, startTransition] = React.useTransition();
  const locationById = new Map(locations.map((l) => [l.id, l]));

  const used = weekdayNames
    .map((label, weekday) => ({
      label,
      weekday,
      items: templates.filter((tpl) => tpl.weekday === weekday),
    }))
    .filter((g) => g.items.length);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <TemplateDialog locations={locations} />
      </CardHeader>
      <CardContent className="space-y-4">
        {used.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("emptyState")}
          </p>
        ) : null}

        {used.map((group) => (
          <div key={group.weekday}>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((tpl, i) => (
                <React.Fragment key={tpl.id}>
                  {i > 0 ? <Separator /> : null}
                  <div className="flex items-center gap-3 py-2">
                    <span className="w-14 shrink-0 text-sm tabular-nums">
                      {formatClock(tpl.start_time)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {locationById.get(tpl.location_id)?.name ?? "-"}
                    </span>
                    <Badge variant="secondary">
                      {t("slots", { count: tpl.slots })}
                    </Badge>
                    <TemplateDialog locations={locations} template={tpl} />
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={pending}
                      aria-label={t("delete")}
                      onClick={() =>
                        startTransition(async () => {
                          const message = resultError(
                            await deleteTemplateAction(tpl.id),
                          );
                          if (message) toast.error(message);
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TemplateDialog({
  locations,
  template,
}: {
  locations: Location[];
  template?: MassTemplate;
}) {
  const router = useRouter();
  const t = useTranslations("group.templates");
  const common = useTranslations("common");
  const weekdayNames = useWeekdayNames();
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(saveTemplateAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  // A deactivated place stays selectable while it is the one already chosen,
  // so editing an old row does not silently move the Mass somewhere else.
  const active = locations.filter((l) => l.active || l.id === template?.location_id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {template ? (
          <Button size="icon" variant="ghost" aria-label={t("edit")}>
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" disabled={!locations.length}>
            <Plus className="h-4 w-4" />
            {t("add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {template ? t("dialog.editTitle") : t("dialog.createTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {template ? <input type="hidden" name="id" value={template.id} /> : null}
          <div className="space-y-2">
            <Label htmlFor="tpl-location">{t("dialog.locationLabel")}</Label>
            <FormSelect
              id="tpl-location"
              name="locationId"
              defaultValue={template?.location_id}
              options={active.map((l) => ({ value: l.id, label: l.name }))}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tpl-weekday">{t("dialog.weekdayLabel")}</Label>
              <FormSelect
                id="tpl-weekday"
                name="weekday"
                defaultValue={String(template?.weekday ?? 0)}
                options={weekdayNames.map((label, i) => ({
                  value: String(i),
                  label,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-time">{t("dialog.timeLabel")}</Label>
              <Input
                id="tpl-time"
                name="startTime"
                type="time"
                defaultValue={template?.start_time?.slice(0, 5) ?? DEFAULT_START_TIME}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-slots">{t("dialog.slotsLabel")}</Label>
              <Input
                id="tpl-slots"
                name="slots"
                type="number"
                min={1}
                max={MAX_SLOTS}
                defaultValue={template?.slots ?? DEFAULT_SLOTS}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-label">{t("dialog.noteLabel")}</Label>
            <Input
              id="tpl-label"
              name="label"
              defaultValue={template?.label ?? ""}
              placeholder={t("dialog.notePlaceholder")}
            />
          </div>
          <SubmitButton pending={pending} className="w-full">
            {common("save")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
