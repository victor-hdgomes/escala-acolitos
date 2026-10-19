"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateParishAction } from "@/app/(app)/grupos/actions";
import { FormSelect } from "@/components/molecules/form-select";
import { SubmitButton } from "@/components/molecules/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import type { Parish } from "@/lib/db/types";

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Cuiaba",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Rio_Branco",
  "America/Boa_Vista",
  "America/Campo_Grande",
];

export function GeneralPanel({ parish }: { parish: Parish }) {
  const router = useRouter();
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateParishAction,
    null,
  );

  React.useEffect(() => {
    if (state?.ok) {
      toast.success("Grupo atualizado");
      router.refresh();
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dados do grupo</CardTitle>
        <CardDescription>
          O fuso define o horário que todo mundo vê — inclusive quem abrir o
          link de outro estado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="parish-name">Nome</Label>
            <Input id="parish-name" name="name" defaultValue={parish.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parish-tz">Fuso horário</Label>
            <FormSelect
              id="parish-tz"
              name="timezone"
              defaultValue={parish.timezone}
              options={TIMEZONES.map((tz) => ({
                value: tz,
                label: tz.replace("America/", "").replace(/_/g, " "),
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Identificador</Label>
            <Input value={parish.slug} readOnly disabled />
          </div>
          <SubmitButton>Salvar</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
