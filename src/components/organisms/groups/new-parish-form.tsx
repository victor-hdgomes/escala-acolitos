"use client";

import { useActionState } from "react";

import { createParishAction } from "@/app/(app)/grupos/actions";
import { SubmitButton } from "@/components/molecules/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormSelect } from "@/components/molecules/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";

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

export function NewParishForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    createParishAction,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo grupo</CardTitle>
        <CardDescription>
          Um grupo é uma paróquia ou ministério: tem a própria lista de
          acólitos, locais e escalas. Você entra como administrador.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state && !state.ok ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do grupo</Label>
            <Input
              id="name"
              name="name"
              placeholder="Paróquia Cristo Rei — Parque Atheneu"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Fuso horário</Label>
            <FormSelect
              id="timezone"
              name="timezone"
              defaultValue="America/Sao_Paulo"
              options={TIMEZONES.map((tz) => ({
                value: tz,
                label: tz.replace("America/", "").replace(/_/g, " "),
              }))}
            />
          </div>
          <SubmitButton className="w-full">Criar grupo</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
