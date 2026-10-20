"use client";

import * as React from "react";
import { CalendarHeart, CalendarRange, Plus } from "lucide-react";
import { toast } from "sonner";

import { createScheduleAction } from "@/app/(app)/escalas/actions";
import { FormSelect } from "@/components/molecules/form-select";
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
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<Kind>("monthly");
  const [generate, setGenerate] = React.useState(hasTemplates);

  const { onSubmit, pending } = useFormAction(createScheduleAction, {
    // Sucesso redireciona pela própria action; só o erro volta até aqui.
    onError: (message) => toast.error(message),
  });

  const nextMonth = addMonths(currentMonthIso(timezone), 1).slice(0, 7);
  const firstOfNextMonth = `${nextMonth}-01`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setKind("monthly");
      }}
    >
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
            {kind === "monthly"
              ? "O mês já nasce com as missas da grade semanal. Você ajusta depois."
              : "Uma novena tem link e prazo próprios — não precisa entrar na escala do mês."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <KindOption
            icon={CalendarRange}
            label="Mensal"
            hint="As missas do mês"
            active={kind === "monthly"}
            onClick={() => setKind("monthly")}
          />
          <KindOption
            icon={CalendarHeart}
            label="Novena"
            hint="Dias seguidos"
            active={kind === "novena"}
            onClick={() => setKind("novena")}
          />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="kind" value={kind} />

          {kind === "monthly" ? (
            <MonthlyFields
              defaultMonth={nextMonth}
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
            {kind === "monthly" ? "Criar escala" : "Criar novena"}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
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
  hasTemplates,
  generate,
  onGenerateChange,
}: {
  defaultMonth: string;
  hasTemplates: boolean;
  generate: boolean;
  onGenerateChange: (value: boolean) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="sch-month">Mês</Label>
        <Input
          id="sch-month"
          name="month"
          type="month"
          defaultValue={defaultMonth}
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
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="nov-title">Nome</Label>
        <Input
          id="nov-title"
          name="title"
          placeholder="Novena em honra a Nossa Senhora Aparecida"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nov-location">Local</Label>
        <FormSelect
          id="nov-location"
          name="locationId"
          options={locations.map((l) => ({ value: l.id, label: l.name }))}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nov-first">Primeiro dia</Label>
          <Input
            id="nov-first"
            name="firstDay"
            type="date"
            defaultValue={defaultFirstDay}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nov-time">Hora</Label>
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
          <Label htmlFor="nov-days">Dias</Label>
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
          <Label htmlFor="nov-slots">Vagas por dia</Label>
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
        <Label htmlFor="nov-mode">Quem preenche</Label>
        <FormSelect
          id="nov-mode"
          name="signupMode"
          defaultValue="direct"
          options={[
            { value: "direct", label: "O acólito pega a vaga" },
            { value: "availability", label: "O coordenador escala" },
          ]}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nov-deadline">Prazo (opcional)</Label>
        <Input id="nov-deadline" name="deadline" type="date" />
      </div>
    </>
  );
}
