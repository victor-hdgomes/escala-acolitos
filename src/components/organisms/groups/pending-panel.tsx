"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { redeemJoinLinkAction } from "@/app/(app)/groups/actions";
import { CopyValue } from "@/components/molecules/copy-value";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResultError } from "@/hooks/use-error-message";
import { EVENTS, track } from "@/lib/analytics";

/**
 * The last segment of whatever was pasted.
 *
 * People paste the whole link far more often than the token, and a link
 * copied out of WhatsApp arrives with tracking noise and a trailing slash.
 * Taking the last path segment handles all of it, and a bare token is already
 * its own last segment.
 */
function tokenFrom(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return url.pathname.split("/").filter(Boolean).pop() ?? "";
  } catch {
    return trimmed.split("/").filter(Boolean).pop() ?? "";
  }
}

export interface PendingPanelProps {
  /** The code this account reads out to whoever coordinates a group. */
  joinCode: string;
  email: string | null;
  canCreateGroup: boolean;
}

/**
 * Where an account with no group waits.
 *
 * Three ways out, in the order they actually happen: someone was sent a link
 * and pastes it; someone has to be added by hand and needs their code to read
 * out; someone is the organiser and opens their own group.
 */
export function PendingPanel({
  joinCode,
  email,
  canCreateGroup,
}: PendingPanelProps) {
  const router = useRouter();
  const t = useTranslations("pending");
  const resultError = useResultError();

  const [link, setLink] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function join() {
    const token = tokenFrom(link);
    if (!token) return;
    startTransition(async () => {
      const message = resultError(await redeemJoinLinkAction(token));
      if (message) {
        toast.error(message);
        return;
      }
      track(EVENTS.joinLinkRedeemed, { from: "pending" });
      toast.success(t("joined"));
      router.push("/home");
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("link.title")}</CardTitle>
          <CardDescription>{t("link.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="join-link" className="sr-only">
            {t("link.label")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="join-link"
              value={link}
              placeholder={t("link.placeholder")}
              autoComplete="off"
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                join();
              }}
            />
            <Button disabled={pending || !link.trim()} onClick={join}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("link.action")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("code.title")}</CardTitle>
          <CardDescription>{t("code.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CopyValue value={joinCode} variant="code" />
          {email ? (
            <p className="text-xs text-muted-foreground">
              {t("code.signedInAs", { email })}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canCreateGroup ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("create.title")}</CardTitle>
            <CardDescription>{t("create.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/groups/new">
                <PlusCircle className="h-4 w-4" />
                {t("create.action")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
