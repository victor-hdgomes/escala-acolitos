"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { claimPersonAction } from "@/app/(app)/grupo/actions";
import {
  PersonPicker,
  type PickablePerson,
} from "@/components/organisms/fill/person-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ClaimNameCard({
  people,
}: {
  people: Array<{ id: string; name: string; claimed: boolean }>;
}) {
  const router = useRouter();
  const [person, setPerson] = React.useState<PickablePerson | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const pickable: PickablePerson[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    claimed: p.claimed,
    isMe: false,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vincular meu nome</CardTitle>
        <CardDescription>
          Depois de vincular, só você marca disponibilidade com esse nome — e
          passa a receber os avisos por e-mail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setOpen(true)}
        >
          <UserRound className="h-4 w-4" />
          {person ? person.name : "Escolher meu nome"}
        </Button>
        <Button
          className="w-full"
          disabled={!person || pending}
          onClick={() =>
            person &&
            startTransition(async () => {
              const res = await claimPersonAction(person.id);
              if (!res.ok) toast.error(res.error);
              else {
                toast.success("Nome vinculado");
                router.refresh();
              }
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Vincular
        </Button>
        <p className="text-xs text-muted-foreground">
          Não achou seu nome? Peça à coordenação para incluir.
        </p>
      </CardContent>

      <PersonPicker
        people={pickable}
        value={person}
        onChange={setPerson}
        open={open}
        onOpenChange={setOpen}
      />
    </Card>
  );
}
