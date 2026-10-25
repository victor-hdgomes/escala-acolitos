"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Church, Loader2, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { acceptSwapAction } from "@/app/t/[token]/actions";
import {
  PersonPicker,
  type PickablePerson,
} from "@/components/organisms/fill/person-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useResultError } from "@/hooks/use-error-message";
import type { SwapStatus } from "@/lib/db/types";

export function SwapView({
  token,
  parishName,
  status,
  reason,
  requesterName,
  filledByName,
  locationName,
  whenLabel,
  isPast,
  candidates,
  others,
}: {
  token: string;
  parishName: string;
  status: SwapStatus;
  reason: string | null;
  requesterName: string;
  filledByName: string | null;
  locationName: string;
  whenLabel: string;
  isPast: boolean;
  candidates: PickablePerson[];
  others: PickablePerson[];
}) {
  const t = useTranslations("swap");
  const resultError = useResultError();
  const router = useRouter();
  const [person, setPerson] = React.useState<PickablePerson | null>(
    () => [...candidates, ...others].find((p) => p.isMe) ?? null,
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);
  // With no candidates there is nothing to choose from: open on the whole
  // group, or the picker shows up empty on the most urgent screen in the app.
  const [showAll, setShowAll] = React.useState(candidates.length === 0);
  const [pending, startTransition] = React.useTransition();

  const closed = status !== "open" || isPast;

  // One screen, four states - each names itself.
  const state =
    status === "filled"
      ? "filled"
      : status === "cancelled"
        ? "cancelled"
        : isPast
          ? "past"
          : "open";

  const accept = (chosen: PickablePerson) =>
    startTransition(async () => {
      const error = resultError(
        await acceptSwapAction({ token, personId: chosen.id }),
      );
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(t("acceptedToast"));
      router.refresh();
    });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Church className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">{parishName}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t(`heading.${state}`)}</CardTitle>
          <CardDescription>
            {status === "filled"
              ? t("subheading.filled", {
                  name: filledByName ?? t("unknownFiller"),
                  requester: requesterName,
                })
              : t("subheading.open", { requester: requesterName })}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
              {whenLabel}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              {locationName}
            </p>
          </div>

          {reason ? (
            <Alert>
              <AlertDescription>{t("reasonLabel", { reason })}</AlertDescription>
            </Alert>
          ) : null}

          {closed ? (
            <Alert>
              <AlertDescription>{t(`closedNote.${state}`)}</AlertDescription>
            </Alert>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setPickerOpen(true)}
              >
                {person ? person.name : t("identifyAction")}
              </Button>

              <Button
                className="w-full"
                disabled={!person || pending}
                onClick={() => person && accept(person)}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {t("acceptAction")}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                {t("firstComeNote")}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {!closed && candidates.length > 0 ? (
        <button
          className="mt-4 text-center text-xs text-muted-foreground underline underline-offset-4"
          onClick={() => {
            setShowAll((v) => !v);
            setPerson(null);
          }}
        >
          {showAll ? t("showCandidatesAction") : t("showAllAction")}
        </button>
      ) : null}

      <PersonPicker
        people={showAll ? [...candidates, ...others] : candidates}
        value={person}
        onChange={setPerson}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={t("picker.title")}
        description={
          showAll
            ? t("picker.descriptionAll")
            : t("picker.descriptionCandidates")
        }
        emptyMessage={t("picker.emptyState")}
      />
    </div>
  );
}
