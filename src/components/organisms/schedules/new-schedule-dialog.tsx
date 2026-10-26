"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CalendarHeart,
  CalendarRange,
  MapPin,
  Plus,
  Settings2,
} from "lucide-react";

import { createScheduleAction } from "@/app/(app)/schedules/actions";
import { FormSelect } from "@/components/molecules/form-select";
import { MonthField } from "@/components/molecules/month-field";
import { QuickPlaceForm } from "@/components/organisms/onboarding/quick-place-form";
import { SubmitButton } from "@/components/molecules/submit-button";
import { useFormAction } from "@/hooks/use-form-action";
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
import { Switch } from "@/components/ui/switch";
import { addMonths, currentMonthIso } from "@/lib/date";
import type { LocationLite } from "@/lib/schedule/types";
import { cn } from "@/lib/utils";

type Kind = "monthly" | "novena";

export function NewScheduleDialog({
  hasTemplates,
  timezone,
  locations,
}: {
  hasTemplates: boolean;
  timezone: string;
  locations: LocationLite[];
}) {
  const t = useTranslations("schedules");
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<Kind>("monthly");
  const [generate, setGenerate] = React.useState(hasTemplates);
  const [byHand, setByHand] = React.useState(false);

  // Success redirects from inside the action itself; only the error comes back
  // here, and the hook already toasts it.
  const { onSubmit, pending } = useFormAction(createScheduleAction);

  const nextMonth = addMonths(currentMonthIso(timezone), 1).slice(0, 7);
  const firstOfNextMonth = `${nextMonth}-01`;

  // A form that can only produce an empty schedule is worse than no form: the
  // dead end stays hidden until the assembly tab, long after the choice.
  const needsSetup =
    kind === "monthly" ? !hasTemplates && !byHand : locations.length === 0;

  const chooseKind = (next: Kind) => {
    setKind(next);
    setByHand(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) chooseKind("monthly");
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t("list.newSchedule")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("list.newSchedule")}</DialogTitle>
          <DialogDescription>
            {kind === "monthly"
              ? t("list.newMonthlyDescription")
              : t("list.newNovenaDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <KindOption
            icon={CalendarRange}
            label={t("list.kindMonthlyLabel")}
            hint={t("list.kindMonthlyHint")}
            active={kind === "monthly"}
            onClick={() => chooseKind("monthly")}
          />
          <KindOption
            icon={CalendarHeart}
            label={t("list.kindNovenaLabel")}
            hint={t("list.kindNovenaHint")}
            active={kind === "novena"}
            onClick={() => chooseKind("novena")}
          />
        </div>

        {needsSetup ? (
          kind === "monthly" ? (
            <MonthlySetupNeeded onByHand={() => setByHand(true)} />
          ) : (
            <NovenaSetupNeeded />
          )
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <input type="hidden" name="kind" value={kind} />

            {kind === "monthly" ? (
              <MonthlyFields
                defaultMonth={nextMonth}
                referenceMonth={currentMonthIso(timezone).slice(0, 7)}
                hasTemplates={hasTemplates}
                generate={generate}
                onGenerateChange={setGenerate}
              />
            ) : (
              <NovenaFields
                locations={locations}
                defaultFirstDay={firstOfNextMonth}
              />
            )}

            <SubmitButton pending={pending} className="w-full">
              {kind === "monthly"
                ? t("list.createSchedule")
                : t("novena.create")}
            </SubmitButton>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SetupNotice({
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
    <div className="rounded-lg border border-dashed border-border p-5 text-center">
      <Icon className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-balance text-muted-foreground">{body}</p>
      <div className="mt-4 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function MonthlySetupNeeded({ onByHand }: { onByHand: () => void }) {
  const t = useTranslations("schedules");

  return (
    <SetupNotice
      icon={Settings2}
      title={t("setup.monthlyTitle")}
      body={t("setup.monthlyBody")}
    >
      <QuickPlaceForm />
      <Button asChild className="tap-target">
        <Link href="/group?tab=templates">{t("setup.patternAction")}</Link>
      </Button>
      <Button asChild variant="outline" className="tap-target">
        <Link href="/people">{t("setup.peopleAction")}</Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="tap-target text-muted-foreground"
        onClick={onByHand}
      >
        {t("setup.byHandAction")}
      </Button>
    </SetupNotice>
  );
}

function NovenaSetupNeeded() {
  const t = useTranslations("schedules");

  return (
    <SetupNotice
      icon={MapPin}
      title={t("setup.novenaTitle")}
      body={t("setup.novenaBody")}
    >
      <QuickPlaceForm />
      <Button asChild variant="outline" className="tap-target">
        <Link href="/group?tab=locations">{t("setup.locationAction")}</Link>
      </Button>
    </SetupNotice>
  );
}

function KindOption({
  icon: Icon,
  label,
  hint,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary bg-accent"
          : "border-border hover:bg-accent/50",
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

function MonthlyFields({
  defaultMonth,
  referenceMonth,
  hasTemplates,
  generate,
  onGenerateChange,
}: {
  defaultMonth: string;
  /** The month the picker's window is centred on, in the parish's zone. */
  referenceMonth: string;
  hasTemplates: boolean;
  generate: boolean;
  onGenerateChange: (value: boolean) => void;
}) {
  const t = useTranslations("schedules");

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="sch-month">{t("fields.month")}</Label>
        <MonthField
          id="sch-month"
          name="month"
          defaultValue={defaultMonth}
          // Both anchored to the parish zone. Left to its UTC fallback the
          // list slid a month for the last hours of every month here.
          referenceMonth={referenceMonth}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sch-deadline">{t("list.deadlineLabel")}</Label>
        <Input id="sch-deadline" name="deadline" type="date" />
        <p className="text-xs text-muted-foreground">{t("list.deadlineHint")}</p>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
        <span className="min-w-0 text-sm">
          {t("list.generateLabel")}
          <span className="block text-xs text-muted-foreground">
            {hasTemplates
              ? t("list.generateHint")
              : t("list.generateEmptyHint")}
          </span>
        </span>
        <Switch
          checked={generate}
          onCheckedChange={onGenerateChange}
          disabled={!hasTemplates}
        />
      </label>
      <input type="hidden" name="generate" value={generate ? "on" : "off"} />
    </>
  );
}

function NovenaFields({
  locations,
  defaultFirstDay,
}: {
  locations: LocationLite[];
  defaultFirstDay: string;
}) {
  const t = useTranslations("schedules");

  return (
    <>
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
          <Label htmlFor="nov-first">{t("fields.firstDay")}</Label>
          <Input
            id="nov-first"
            name="firstDay"
            type="date"
            defaultValue={defaultFirstDay}
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
            required
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
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nov-mode">{t("novena.whoFills")}</Label>
        <FormSelect
          id="nov-mode"
          name="signupMode"
          defaultValue="direct"
          options={[
            { value: "direct", label: t("novena.modeDirect") },
            { value: "availability", label: t("novena.modeCoordinator") },
          ]}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nov-deadline">{t("novena.deadlineOptional")}</Label>
        <Input id="nov-deadline" name="deadline" type="date" />
      </div>
    </>
  );
}
