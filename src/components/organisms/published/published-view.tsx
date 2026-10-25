"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Church,
  Copy,
  Loader2,
  MessageCircle,
  Repeat2,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { requestSwapPublicAction } from "@/app/v/[token]/actions";
import {
  PersonPicker,
  type PickablePerson,
} from "@/components/organisms/fill/person-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useErrorMessage } from "@/hooks/use-error-message";
import { copyToClipboard, whatsAppUrl } from "@/lib/client-utils";
import { cn } from "@/lib/utils";

export interface PublishedSlot {
  position: number;
  assignmentId: string | null;
  personId: string | null;
  name: string | null;
  claimed: boolean;
  swapOpen: boolean;
  swapToken: string | null;
}

export interface PublishedEvent {
  id: string;
  timeLabel: string;
  locationName: string;
  locationColor: string;
  label: string | null;
  isPast: boolean;
  slots: PublishedSlot[];
}

interface PublishedDay {
  key: string;
  title: string;
  weekdayLabel: string;
  events: PublishedEvent[];
}

const STORAGE_PREFIX = "altar:published-person:";

export function PublishedView({
  token,
  parishName,
  title,
  monthTitle,
  days,
  people,
  todayKey,
}: {
  token: string;
  parishName: string;
  title: string;
  monthTitle: string;
  days: PublishedDay[];
  people: PickablePerson[];
  todayKey: string;
}) {
  const t = useTranslations("published");
  const tCommon = useTranslations("common");
  const [person, setPerson] = React.useState<PickablePerson | null>(
    () => people.find((p) => p.isMe) ?? null,
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [onlyMine, setOnlyMine] = React.useState(false);
  const [swapTarget, setSwapTarget] = React.useState<{
    event: PublishedEvent;
    slot: PublishedSlot;
  } | null>(null);

  // Read localStorage only after mounting: it does not exist on the server,
  // and a value read during render would break hydration.
  React.useEffect(() => {
    if (person) return;
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + token);
      const found = stored ? people.find((p) => p.id === stored) : null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is an external system
      if (found) setPerson(found);
    } catch {
      // storage blocked - carry on without remembering
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!person) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + token, person.id);
    } catch {
      // ignore
    }
  }, [person, token]);

  const visibleDays = React.useMemo(() => {
    if (!onlyMine || !person) return days;
    return days
      .map((d) => ({
        ...d,
        events: d.events.filter((e) =>
          e.slots.some((s) => s.personId === person.id),
        ),
      }))
      .filter((d) => d.events.length);
  }, [days, onlyMine, person]);

  const myCount = person
    ? days
        .flatMap((d) => d.events)
        .filter((e) => e.slots.some((s) => s.personId === person.id)).length
    : 0;

  return (
    <div className="min-h-screen pb-10">
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setPickerOpen(true)}
          >
            <UserRound className="h-4 w-4" />
            {person ? person.name : t("identifyAction")}
          </Button>
          {person ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={onlyMine} onCheckedChange={setOnlyMine} />
              {t("onlyMineToggle", { count: myCount })}
            </label>
          ) : null}
        </div>

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
              {day.events.map((event) => {
                const names = event.slots.filter((s) => s.name);
                const isMine =
                  !!person && event.slots.some((s) => s.personId === person.id);

                return (
                  <div
                    key={event.id}
                    className={cn(
                      "rounded-lg border p-3",
                      isMine
                        ? "border-[color:var(--color-filled)] bg-[color:var(--color-filled)]/5"
                        : "border-border",
                      event.isPast && "opacity-60",
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: event.locationColor }}
                        aria-hidden
                      />
                      <span className="text-sm font-medium tabular-nums">
                        {event.timeLabel}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {event.locationName}
                      </span>
                      {isMine ? (
                        <Badge variant="secondary">{tCommon("you")}</Badge>
                      ) : null}
                    </div>

                    {event.label ? (
                      <p className="mb-1.5 truncate text-xs text-muted-foreground">
                        {event.label}
                      </p>
                    ) : null}

                    {names.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("eventEmptyState")}
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {names.map((slot) => {
                          const mine = person && slot.personId === person.id;
                          return (
                            <li
                              key={slot.position}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                                {slot.position}
                              </span>
                              <span
                                className={cn(
                                  "min-w-0 flex-1 truncate",
                                  slot.swapOpen && "line-through opacity-60",
                                )}
                              >
                                {slot.name}
                              </span>
                              {slot.swapOpen && slot.swapToken ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1 text-[color:var(--color-pending)]"
                                  asChild
                                >
                                  <a href={`/t/${slot.swapToken}`}>
                                    <Repeat2 className="h-3.5 w-3.5" />
                                    {t("swapOpenLink")}
                                  </a>
                                </Button>
                              ) : mine && !event.isPast ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1"
                                  onClick={() => setSwapTarget({ event, slot })}
                                >
                                  <Repeat2 className="h-3.5 w-3.5" />
                                  {t("swapRequestAction")}
                                </Button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {visibleDays.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {onlyMine ? t("emptyStateMine") : t("emptyState")}
          </p>
        ) : null}
      </div>

      <PersonPicker
        people={people}
        value={person}
        onChange={setPerson}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />

      {/* Remounted per request: reason and link start clean. */}
      <SwapDialog
        key={swapTarget?.slot.assignmentId ?? "none"}
        token={token}
        target={swapTarget}
        monthTitle={monthTitle}
        onClose={() => setSwapTarget(null)}
      />
    </div>
  );
}

/**
 * The dialog stays mounted and only toggles `open`. Remounting it on open made
 * it close by itself: the `pointerup` of the click that opened it lands after
 * the mount, and Radix reads that as a click outside. The key goes on the body.
 */
function SwapDialog({
  token,
  target,
  monthTitle,
  onClose,
}: {
  token: string;
  target: { event: PublishedEvent; slot: PublishedSlot } | null;
  monthTitle: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {target ? (
          <SwapDialogBody
            key={target.slot.assignmentId ?? "none"}
            token={token}
            target={target}
            monthTitle={monthTitle}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SwapDialogBody({
  token,
  target,
  monthTitle,
}: {
  token: string;
  target: { event: PublishedEvent; slot: PublishedSlot };
  monthTitle: string;
}) {
  const t = useTranslations("published");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [url, setUrl] = React.useState<string | null>(null);

  const whenLabel = t("swapDialog.whenLabel", {
    time: target.event.timeLabel,
    location: target.event.locationName,
  });

  const message = [
    t("swapDialog.shareHeading"),
    "",
    t("swapDialog.shareDetails", {
      time: target.event.timeLabel,
      location: target.event.locationName,
      month: monthTitle,
    }),
    reason ? t("swapDialog.shareReason", { reason }) : "",
    "",
    t("swapDialog.shareCall"),
    url ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  const submit = () => {
    if (!target.slot.assignmentId) return;
    startTransition(async () => {
      const res = await requestSwapPublicAction({
        token,
        assignmentId: target.slot.assignmentId!,
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(errorMessage(res.code, res.params));
        return;
      }
      setUrl(res.data!.url);
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("swapDialog.title")}</DialogTitle>
        <DialogDescription>{whenLabel}</DialogDescription>
      </DialogHeader>

      {url ? (
        <div className="space-y-3">
          <p className="text-sm">{t("swapDialog.openedState")}</p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
            <code className="min-w-0 flex-1 truncate text-xs">{url}</code>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("swapDialog.copyLink")}
              onClick={() => {
                void copyToClipboard(url);
                toast.success(tCommon("copied"));
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button asChild className="w-full">
            <a
              href={whatsAppUrl(message)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              {tCommon("shareOnWhatsApp")}
            </a>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder={t("swapDialog.reasonPlaceholder")}
            className="w-full rounded-md border border-input bg-transparent p-3 text-sm"
          />
          <Button className="w-full" disabled={pending} onClick={submit}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("swapDialog.submitAction")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("swapDialog.notice")}
          </p>
        </div>
      )}
    </>
  );
}
