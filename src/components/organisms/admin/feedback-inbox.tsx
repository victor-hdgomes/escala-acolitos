"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Mail } from "lucide-react";
import { toast } from "sonner";

import { setFeedbackStatusAction } from "@/app/(app)/feedback/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useResultError } from "@/hooks/use-error-message";
import type { FeedbackKind, FeedbackStatus } from "@/lib/db/types";

export interface FeedbackRow {
  id: string;
  kind: FeedbackKind;
  message: string;
  page: string | null;
  status: FeedbackStatus;
  createdLabel: string;
  parishName: string | null;
  authorName: string | null;
  contactEmail: string | null;
}

/**
 * What the parishes are writing in, newest first.
 *
 * Unanswered messages stay at full strength and the handled ones fade, so the
 * list reads as a queue rather than an archive that grows forever.
 */
export function FeedbackInbox({ rows }: { rows: FeedbackRow[] }) {
  const router = useRouter();
  const t = useTranslations("admin.feedback");
  const kinds = useTranslations("feedback.kinds");
  const resultError = useResultError();
  const [pending, startTransition] = React.useTransition();

  function setStatus(id: string, status: FeedbackStatus) {
    startTransition(async () => {
      const message = resultError(await setFeedbackStatusAction(id, status));
      if (message) {
        toast.error(message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : null}

        {rows.map((row, i) => (
          <div key={row.id} className={row.status === "done" ? "opacity-50" : ""}>
            {i > 0 ? <Separator /> : null}
            <div className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{kinds(row.kind)}</Badge>
                {row.status === "new" ? <Badge>{t("unread")}</Badge> : null}
                <span className="text-xs text-muted-foreground">
                  {row.createdLabel}
                </span>
              </div>

              <p className="text-sm whitespace-pre-wrap">{row.message}</p>

              <p className="text-xs text-muted-foreground">
                {[row.authorName, row.parishName, row.page]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              <div className="flex flex-wrap gap-2">
                {row.contactEmail ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`mailto:${row.contactEmail}`}>
                      <Mail className="h-4 w-4" />
                      {t("reply")}
                    </a>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    setStatus(row.id, row.status === "done" ? "new" : "done")
                  }
                >
                  <Check className="h-4 w-4" />
                  {row.status === "done" ? t("reopen") : t("markDone")}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
