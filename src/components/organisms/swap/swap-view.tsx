"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Church, Loader2, MapPin } from "lucide-react";
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
  const router = useRouter();
  const [person, setPerson] = React.useState<PickablePerson | null>(
    () => [...candidates, ...others].find((p) => p.isMe) ?? null,
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const closed = status !== "open" || isPast;

  const accept = (chosen: PickablePerson) =>
    startTransition(async () => {
      const res = await acceptSwapAction({ token, personId: chosen.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Vaga assumida. Obrigado!");
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
          <CardTitle>
            {status === "filled"
              ? "Vaga já assumida"
              : status === "cancelled"
                ? "Pedido cancelado"
                : isPast
                  ? "Celebração já passou"
                  : "Alguém precisa de substituição"}
          </CardTitle>
          <CardDescription>
            {status === "filled"
              ? `${filledByName ?? "Outro acólito"} assumiu o lugar de ${requesterName}.`
              : `${requesterName} não vai conseguir servir.`}
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
              <AlertDescription>Motivo: {reason}</AlertDescription>
            </Alert>
          ) : null}

          {closed ? (
            <Alert>
              <AlertDescription>
                {status === "filled"
                  ? "Nada a fazer por aqui."
                  : status === "cancelled"
                    ? "Quem pediu acabou resolvendo."
                    : "Essa data já passou."}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setPickerOpen(true)}
              >
                {person ? person.name : "Quem é você?"}
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
                Posso assumir
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Primeiro que confirmar fica com a vaga.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {!closed ? (
        <button
          className="mt-4 text-center text-xs text-muted-foreground underline underline-offset-4"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll
            ? "Mostrar só quem marcou disponibilidade"
            : "Não acho meu nome na lista"}
        </button>
      ) : null}

      <PersonPicker
        people={showAll ? [...candidates, ...others] : candidates}
        value={person}
        onChange={setPerson}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </div>
  );
}
