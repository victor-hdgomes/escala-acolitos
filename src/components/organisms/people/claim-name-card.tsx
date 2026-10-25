"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { claimPersonAction } from "@/app/(app)/group/actions";
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
import { useResultError } from "@/hooks/use-error-message";

export function ClaimNameCard({
  people,
}: {
  people: Array<{ id: string; name: string; claimed: boolean }>;
}) {
  const t = useTranslations("home.claimName");
  const router = useRouter();
  const resultError = useResultError();
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
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setOpen(true)}
        >
          <UserRound className="h-4 w-4" />
          {person ? person.name : t("choose")}
        </Button>
        <Button
          className="w-full"
          disabled={!person || pending}
          onClick={() =>
            person &&
            startTransition(async () => {
              const result = await claimPersonAction(person.id);
              const message = resultError(result);
              if (message) {
                toast.error(message);
                return;
              }
              toast.success(t("linked"));
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("submit")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("notFound")}</p>
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
