"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarCheck2,
  Copy,
  Loader2,
  MessageCircle,
  Repeat2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  cancelSwapAction,
  requestSwapAction,
} from "@/app/(app)/schedules/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useErrorMessage, useResultError } from "@/hooks/use-error-message";
import { appUrlClient, copyToClipboard, whatsAppUrl } from "@/lib/client-utils";
import { cn } from "@/lib/utils";

/**
 * A Mass with its dates already written out.
 *
 * The page formats them on the server, where the parish's time zone lives, so
 * this component only ever lays text out.
 */
export interface MyMassRow {
  assignmentId: string;
  eventId: string;
  viewToken: string;
  whenLabel: string;
  timeLabel: string;
  relativeLabel: string;
  locationName: string;
  locationColor: string;
  label: string | null;
  position: number;
  swapOpen: boolean;
  swapId: string | null;
  swapToken: string | null;
}

export function MyMassesList({ masses }: { masses: MyMassRow[] }) {
  const t = useTranslations("myMasses");
  const [target, setTarget] = React.useState<MyMassRow | null>(null);

  if (masses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CalendarCheck2 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("list.emptyState")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {masses.map((m) => (
        <MassRow key={m.assignmentId} mass={m} onSwap={() => setTarget(m)} />
      ))}
      <SwapDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function MassRow({ mass, onSwap }: { mass: MyMassRow; onSwap: () => void }) {
  const t = useTranslations("myMasses");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const resultError = useResultError();
  const [pending, startTransition] = React.useTransition();

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        mass.swapOpen
          ? "border-[color:var(--color-pending)]/50 bg-[color:var(--color-pending)]/5"
          : "border-border",
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: mass.locationColor }}
          aria-hidden
        />
        <span className="text-sm font-medium tabular-nums">
          {mass.timeLabel}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {mass.locationName}
        </span>
        <Badge variant="secondary">{mass.relativeLabel}</Badge>
      </div>

      <p className="truncate text-xs text-muted-foreground">
        {mass.label
          ? t("list.whenWithLabel", { when: mass.whenLabel, label: mass.label })
          : mass.whenLabel}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {mass.swapOpen && mass.swapToken ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void copyToClipboard(appUrlClient(`/t/${mass.swapToken}`));
                toast.success(tCommon("copied"));
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              {t("list.copyLink")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await cancelSwapAction(mass.swapId!);
                  const message = resultError(result);
                  if (message) {
                    toast.error(message);
                    return;
                  }
                  toast.success(t("toast.requestCancelled"));
                  router.refresh();
                })
              }
            >
              <X className="h-3.5 w-3.5" />
              {t("list.cancelRequest")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={onSwap}>
            <Repeat2 className="h-3.5 w-3.5" />
            {t("list.cantMakeIt")}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The dialog stays mounted and only toggles `open`. Remounting it on open made
 * it close by itself: the `pointerup` of the click that opened it arrives
 * after mount and Radix reads it as a click outside. The key goes on the body,
 * which is the part that has to start clean for every request.
 */
function SwapDialog({
  target,
  onClose,
}: {
  target: MyMassRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {target ? (
          <SwapDialogBody key={target.assignmentId} target={target} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SwapDialogBody({ target }: { target: MyMassRow }) {
  const t = useTranslations("myMasses");
  const tCommon = useTranslations("common");
  const router = useRouter();
  // Not `useResultError` here: the success branch reads `result.data`, so the
  // result has to be narrowed by `result.ok` rather than by the message.
  const errorMessage = useErrorMessage();
  const [reason, setReason] = React.useState("");
  const [url, setUrl] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const whenAt = t("whenAt", {
    date: target.whenLabel,
    time: target.timeLabel,
  });

  // The reason line only exists when the person wrote one, and the link only
  // after the request is open - the filter drops whichever is still empty.
  const message = [
    t("whatsApp.header"),
    whenAt,
    target.locationName,
    reason ? t("whatsApp.reason", { reason }) : "",
    t("whatsApp.callToAction"),
    url ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("swapDialog.title")}</DialogTitle>
        <DialogDescription>{whenAt}</DialogDescription>
      </DialogHeader>

      {url ? (
        <div className="space-y-3">
          <p className="text-sm">{t("swapDialog.opened")}</p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
            <code className="min-w-0 flex-1 truncate text-xs">{url}</code>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("swapDialog.copyLinkLabel")}
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
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await requestSwapAction({
                  assignmentId: target.assignmentId,
                  reason: reason.trim() || undefined,
                });
                if (!result.ok) {
                  toast.error(errorMessage(result.code, result.params));
                  return;
                }
                setUrl(result.data!.url);
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("swapDialog.submit")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("swapDialog.notice")}
          </p>
        </div>
      )}
    </>
  );
}
