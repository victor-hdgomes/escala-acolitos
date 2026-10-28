"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { redeemJoinLinkAction } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { useResultError } from "@/hooks/use-error-message";
import { EVENTS, track } from "@/lib/analytics";

/** Spends the join link the visitor arrived on, for an account already signed in. */
export function JoinWithLink({ token }: { token: string }) {
  const router = useRouter();
  const t = useTranslations("join");
  const resultError = useResultError();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const message = resultError(await redeemJoinLinkAction(token));
          if (message) {
            toast.error(message);
            return;
          }
          track(EVENTS.joinLinkRedeemed, { from: "link" });
          toast.success(t("joined"));
          router.push("/home");
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {t("action")}
    </Button>
  );
}
