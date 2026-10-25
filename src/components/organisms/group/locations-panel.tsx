"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteLocationAction,
  saveLocationAction,
  toggleLocationAction,
} from "@/app/(app)/group/actions";
import { SubmitButton } from "@/components/molecules/submit-button";
import { useResultError } from "@/hooks/use-error-message";
import { useFormAction } from "@/hooks/use-form-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/action-result";
import type { Location } from "@/lib/db/types";

/** Fallback colour for a new place, matched by the server-side schema. */
const DEFAULT_COLOR = "#6366f1";

export function LocationsPanel({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const t = useTranslations("group.locations");
  const resultError = useResultError();
  const [pending, startTransition] = React.useTransition();

  /** Every row action reports the same way: toast on failure, refresh on success. */
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const message = resultError(await action());
      if (message) toast.error(message);
      else router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          {t("title", { count: locations.length })}
        </CardTitle>
        <LocationDialog nextOrder={locations.length + 1} />
      </CardHeader>
      <CardContent className="space-y-1">
        {locations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("emptyState")}
          </p>
        ) : null}
        {locations.map((loc, i) => (
          <React.Fragment key={loc.id}>
            {i > 0 ? <Separator /> : null}
            <div className="flex items-center gap-3 py-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: loc.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{loc.name}</p>
                {loc.short_name ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {loc.short_name}
                  </p>
                ) : null}
              </div>
              {!loc.active ? (
                <Badge variant="secondary">{t("inactive")}</Badge>
              ) : null}
              <Switch
                checked={loc.active}
                disabled={pending}
                aria-label={t("activeToggle")}
                onCheckedChange={(checked) =>
                  run(() => toggleLocationAction(loc.id, checked))
                }
              />
              <LocationDialog location={loc} nextOrder={loc.sort_order} />
              <Button
                size="icon"
                variant="ghost"
                disabled={pending}
                aria-label={t("delete", { name: loc.name })}
                onClick={() => run(() => deleteLocationAction(loc.id))}
              >
                <Trash2 className="h-4 w-4 text-[color:var(--color-open)]" />
              </Button>
            </div>
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
}

function LocationDialog({
  location,
  nextOrder,
}: {
  location?: Location;
  nextOrder: number;
}) {
  const router = useRouter();
  const t = useTranslations("group.locations");
  const common = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(saveLocationAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {location ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("edit", { name: location.name })}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {t("add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {location ? t("dialog.editTitle") : t("dialog.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {location ? (
            <input type="hidden" name="id" value={location.id} />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="loc-name">{t("dialog.nameLabel")}</Label>
            <Input
              id="loc-name"
              name="name"
              defaultValue={location?.name}
              placeholder={t("dialog.namePlaceholder")}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loc-short">{t("dialog.shortNameLabel")}</Label>
              <Input
                id="loc-short"
                name="shortName"
                defaultValue={location?.short_name ?? ""}
                placeholder={t("dialog.shortNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-order">{t("dialog.sortOrderLabel")}</Label>
              <Input
                id="loc-order"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={location?.sort_order ?? nextOrder}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc-color">{t("dialog.colorLabel")}</Label>
            <Input
              id="loc-color"
              name="color"
              type="color"
              defaultValue={location?.color ?? DEFAULT_COLOR}
              className="h-10 w-20 p-1"
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
