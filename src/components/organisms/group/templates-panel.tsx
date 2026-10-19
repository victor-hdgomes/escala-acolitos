"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTemplateAction,
  saveTemplateAction,
} from "@/app/(app)/grupo/actions";
import { FormSelect } from "@/components/molecules/form-select";
import { SubmitButton } from "@/components/molecules/submit-button";
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
import { WEEKDAYS_LONG } from "@/lib/date";
import { formatTimeString } from "@/lib/date";
import type { Location, MassTemplate } from "@/lib/db/types";

export function TemplatesPanel({
  templates,
  locations,
}: {
  templates: MassTemplate[];
  locations: Location[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const locationById = new Map(locations.map((l) => [l.id, l]));

  const byWeekday = WEEKDAYS_LONG.map((label, weekday) => ({
    label,
    weekday,
    items: templates.filter((t) => t.weekday === weekday),
  })).filter((g) => g.items.length);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            Grade semanal
          </CardTitle>
          <CardDescription>
            É daqui que sai o mês inteiro quando você cria uma escala.
          </CardDescription>
        </div>
        <TemplateDialog locations={locations} />
      </CardHeader>
      <CardContent className="space-y-4">
        {byWeekday.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Grade vazia. Cadastre as missas fixas da semana.
          </p>
        ) : null}

        {byWeekday.map((group) => (
          <div key={group.weekday}>
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((t, i) => (
                <React.Fragment key={t.id}>
                  {i > 0 ? <Separator /> : null}
                  <div className="flex items-center gap-3 py-2">
                    <span className="w-14 shrink-0 text-sm tabular-nums">
                      {formatTimeString(t.start_time)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {locationById.get(t.location_id)?.name ?? "—"}
                    </span>
                    <Badge variant="secondary">
                      {t.slots} {t.slots === 1 ? "vaga" : "vagas"}
                    </Badge>
                    <TemplateDialog locations={locations} template={t} />
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={pending}
                      aria-label="Excluir da grade"
                      onClick={() =>
                        startTransition(async () => {
                          const res = await deleteTemplateAction(t.id);
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
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(saveTemplateAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  const active = locations.filter((l) => l.active || l.id === template?.location_id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {template ? (
          <Button size="icon" variant="ghost" aria-label="Editar missa da grade">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" disabled={!locations.length}>
            <Plus className="h-4 w-4" />
            Nova
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {template ? "Editar missa fixa" : "Nova missa fixa"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {template ? <input type="hidden" name="id" value={template.id} /> : null}
          <div className="space-y-2">
            <Label htmlFor="tpl-location">Local</Label>
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
              <Label htmlFor="tpl-weekday">Dia</Label>
              <FormSelect
                id="tpl-weekday"
                name="weekday"
                defaultValue={String(template?.weekday ?? 0)}
                options={WEEKDAYS_LONG.map((label, i) => ({
                  value: String(i),
                  label,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-time">Hora</Label>
              <Input
                id="tpl-time"
                name="startTime"
                type="time"
                defaultValue={template?.start_time?.slice(0, 5) ?? "19:30"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-slots">Vagas</Label>
              <Input
                id="tpl-slots"
                name="slots"
                type="number"
                min={1}
                max={12}
                defaultValue={template?.slots ?? 4}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-label">Observação (opcional)</Label>
            <Input
              id="tpl-label"
              name="label"
              defaultValue={template?.label ?? ""}
              placeholder="Missa das crianças"
            />
          </div>
          <SubmitButton pending={pending} className="w-full">Salvar</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
