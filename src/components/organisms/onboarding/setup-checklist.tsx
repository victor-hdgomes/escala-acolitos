import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  CalendarPlus,
  CalendarRange,
  Check,
  ChevronDown,
  Lock,
  MapPin,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GuidedTour } from "@/components/organisms/onboarding/guided-tour";
import { QuickPlaceForm } from "@/components/organisms/onboarding/quick-place-form";
import { cn } from "@/lib/utils";

export type SetupChecklistProps = {
  locations: number;
  templates: number;
  people: number;
  schedules: number;
};

type StepKey = "locations" | "templates" | "people" | "schedule";

/**
 * The deep links carry `?tab=`: a coordinator sent to /group lands on Members
 * and has to guess which tab the step meant.
 */
const STEPS: ReadonlyArray<{
  key: StepKey;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}> = [
  { key: "locations", icon: MapPin, href: "/group?tab=locations" },
  { key: "templates", icon: CalendarRange, href: "/group?tab=templates" },
  { key: "people", icon: Users, href: "/people" },
  { key: "schedule", icon: CalendarPlus, href: "/schedules" },
];

/**
 * The four things that have to exist before a month can be scheduled, and the
 * missing instructions for doing them.
 *
 * A coordinator who signs up goes straight to Schedules, creates one and
 * opens an empty assembly tab, because a month is generated from the weekly
 * pattern and nothing ever said so. Hence the order here, the lock on step 4
 * and the explainer: this is the only screen that teaches the loop.
 */
export async function SetupChecklist({
  locations,
  templates,
  people,
  schedules,
}: SetupChecklistProps) {
  const t = await getTranslations("onboarding");

  const done: Record<StepKey, boolean> = {
    locations: locations > 0,
    templates: templates > 0,
    people: people > 0,
    schedule: schedules > 0,
  };

  // A group that is already running should never see this again.
  const doneCount = STEPS.filter((step) => done[step.key]).length;
  if (doneCount === STEPS.length) return null;

  // Opening a month without places and without a pattern produces a schedule
  // with zero celebrations, which is the dead end this card exists to prevent.
  const scheduleLocked = !done.locations || !done.templates;
  const nextKey = STEPS.find((step) => !done[step.key])?.key;

  return (
    <Card data-tour="setup">
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
        <CardAction>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("progress", { done: doneCount, total: STEPS.length })}
          </span>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Above the steps on purpose: the reader who is lost needs the loop
            explained before the to-do list makes any sense. */}
        <details className="group rounded-lg border border-border">
          <summary className="tap-target flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 flex-1">{t("guide.summary")}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <ol className="list-outside list-decimal space-y-1.5 border-t border-border py-3 pr-3 pl-8 text-sm text-muted-foreground">
            <li>{t("guide.send")}</li>
            <li>{t("guide.mark")}</li>
            <li>{t("guide.assemble")}</li>
            <li>{t("guide.publish")}</li>
          </ol>
        </details>

        <GuidedTour autoStart />

        <ol className="space-y-2">
          {STEPS.map((step) => {
            const title = t(`steps.${step.key}.title`);

            if (done[step.key]) {
              return (
                <li
                  key={step.key}
                  className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-filled)]/15 text-[color:var(--color-filled)]">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {title}
                  </span>
                  <span className="sr-only">{t("doneLabel")}</span>
                </li>
              );
            }

            if (step.key === "schedule" && scheduleLocked) {
              return (
                <li
                  key={step.key}
                  className="rounded-lg border border-dashed border-border px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">
                      {title}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("lockedHint")}
                  </p>
                </li>
              );
            }

            const isNext = step.key === nextKey;
            const Icon = step.icon;

            return (
              <li
                key={step.key}
                className={cn(
                  "rounded-lg border p-3",
                  isNext
                    ? "border-primary/40 bg-accent/50"
                    : "border-border bg-background",
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      isNext ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(`steps.${step.key}.why`)}
                    </p>
                  </div>
                </div>
                {step.key === "locations" ? (
                  <div className="mt-3">
                    <QuickPlaceForm />
                  </div>
                ) : null}
                <Button
                  asChild
                  variant={isNext ? "default" : "outline"}
                  className="tap-target mt-3 w-full"
                >
                  <Link href={step.href}>
                    {t(`steps.${step.key}.action`)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
