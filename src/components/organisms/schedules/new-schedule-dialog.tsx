"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createScheduleAction } from "@/app/(app)/escalas/actions";
import { SubmitButton } from "@/components/molecules/submit-button";
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
import type { ActionResult } from "@/lib/action-result";
import { addMonths, currentMonthIso } from "@/lib/date";

export function NewScheduleDialog({
  hasTemplates,
  timezone,
}: {
  hasTemplates: boolean;
  timezone: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [generate, setGenerate] = React.useState(hasTemplates);
  const [state, action] = useActionState<ActionResult | null, FormData>(
    createScheduleAction,
    null,
  );

  React.useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  // Padrão: o mês que vem — é o que se escala na prática.
  const nextMonth = addMonths(currentMonthIso(timezone), 1).slice(0, 7);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Nova escala
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova escala</DialogTitle>
          <DialogDescription>
            O mês já nasce com as missas da grade semanal. Você ajusta depois.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sch-month">Mês</Label>
            <Input
              id="sch-month"
              name="month"
              type="month"
              defaultValue={nextMonth}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sch-deadline">Prazo de preenchimento</Label>
            <Input id="sch-deadline" name="deadline" type="date" />
            <p className="text-xs text-muted-foreground">
              Depois dessa data o link para de aceitar respostas.
            </p>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <span className="min-w-0 text-sm">
              Gerar celebrações da grade
              <span className="block text-xs text-muted-foreground">
                {hasTemplates
                  ? "Cria todas as missas fixas do mês"
                  : "Nenhuma missa fixa cadastrada ainda"}
              </span>
            </span>
            <Switch
              checked={generate}
              onCheckedChange={setGenerate}
              disabled={!hasTemplates}
            />
          </label>
          <input type="hidden" name="generate" value={generate ? "on" : "off"} />
          <SubmitButton className="w-full">Criar escala</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
