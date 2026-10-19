"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { acceptInviteAction } from "@/app/(app)/grupos/actions";
import { Button } from "@/components/ui/button";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await acceptInviteAction(token);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Pronto! Você entrou no grupo.");
          router.push("/inicio");
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Aceitar convite
    </Button>
  );
}
