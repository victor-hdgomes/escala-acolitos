"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { acceptInviteAction } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { useResultError } from "@/hooks/use-error-message";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const t = useTranslations("invite");
  const resultError = useResultError();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const message = resultError(await acceptInviteAction(token));
          if (message) {
            toast.error(message);
            return;
          }
          toast.success(t("accepted"));
          router.push("/home");
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {t("accept")}
    </Button>
  );
}
