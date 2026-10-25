"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, Link2, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createJoinLinkAction,
  deleteJoinLinkAction,
  setJoinLinkActiveAction,
} from "@/app/(app)/groups/actions";
import { FormSelect } from "@/components/molecules/form-select";
import { SubmitButton } from "@/components/molecules/submit-button";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { useResultError } from "@/hooks/use-error-message";
import { useFormAction } from "@/hooks/use-form-action";
import { appUrlClient, copyToClipboard } from "@/lib/client-utils";
import type { JoinLink, Role } from "@/lib/db/types";
import { isPast } from "@/lib/now";

const ROLES: Role[] = ["member", "coordinator", "admin"];

/**
 * The link a coordinator posts once in the group chat.
 *
 * An invitation is one named seat and burns on acceptance, which is right for
 * handing someone the keys and wrong for twenty altar servers who all need to
 * get in. This is the other shape: post it, and everyone who signs up through
 * it lands inside the group already.
 */
export function JoinLinksCard({ links }: { links: JoinLink[] }) {
  const router = useRouter();
  const t = useTranslations("group.joinLinks");
  const roleLabel = useTranslations("group.roles");
  const common = useTranslations("common");
  const resultError = useResultError();
  const [pending, startTransition] = React.useTransition();

  const { onSubmit, pending: creating } = useFormAction(createJoinLinkAction, {
    onSuccess: (data) => {
      if (data?.url) void copyToClipboard(data.url);
      toast.success(t("created"));
      router.refresh();
    },
  });

  function run(work: () => Promise<{ ok: boolean } | unknown>) {
    startTransition(async () => {
      const message = resultError(
        (await work()) as Parameters<typeof resultError>[0],
      );
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
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="link-label">{t("labelField")}</Label>
              <Input
                id="link-label"
                name="label"
                placeholder={t("labelPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-role">{t("roleField")}</Label>
              <FormSelect
                id="link-role"
                name="role"
                defaultValue="member"
                options={ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-max">{t("maxUsesField")}</Label>
              <Input
                id="link-max"
                name="maxUses"
                type="number"
                min={1}
                max={500}
                placeholder={t("maxUsesPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-expiry">{t("expiryField")}</Label>
              <Input
                id="link-expiry"
                name="expiresInDays"
                type="number"
                min={1}
                max={365}
                placeholder={t("expiryPlaceholder")}
              />
            </div>
          </div>
          <SubmitButton pending={creating}>{t("create")}</SubmitButton>
        </form>

        {links.length ? <Separator /> : null}

        {links.map((link, i) => {
          const url = appUrlClient(`/j/${link.token}`);
          const expired = !!link.expires_at && isPast(link.expires_at);
          const exhausted =
            link.max_uses !== null && link.uses >= link.max_uses;
          return (
            <React.Fragment key={link.id}>
              {i > 0 ? <Separator /> : null}
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {link.label || t("untitled")}{" "}
                    <Badge variant="secondary">{roleLabel(link.role)}</Badge>
                    {!link.active ? (
                      <Badge variant="outline" className="ml-1">
                        {t("paused")}
                      </Badge>
                    ) : null}
                    {expired ? (
                      <Badge variant="destructive" className="ml-1">
                        {t("expired")}
                      </Badge>
                    ) : null}
                    {exhausted ? (
                      <Badge variant="destructive" className="ml-1">
                        {t("exhausted")}
                      </Badge>
                    ) : null}
                  </p>
                  <code className="block truncate text-xs text-muted-foreground">
                    {url}
                  </code>
                  <p className="text-xs text-muted-foreground">
                    {link.max_uses === null
                      ? t("usedUnlimited", { used: link.uses })
                      : t("usedCapped", {
                          used: link.uses,
                          max: link.max_uses,
                        })}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={common("copy")}
                  onClick={() => {
                    void copyToClipboard(url);
                    toast.success(common("copied"));
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  aria-label={link.active ? t("pause") : t("resume")}
                  onClick={() =>
                    run(() => setJoinLinkActiveAction(link.id, !link.active))
                  }
                >
                  <Power
                    className={
                      link.active
                        ? "h-4 w-4"
                        : "h-4 w-4 text-muted-foreground"
                    }
                  />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  aria-label={common("delete")}
                  onClick={() => run(() => deleteJoinLinkAction(link.id))}
                >
                  <Trash2 className="h-4 w-4 text-[color:var(--color-open)]" />
                </Button>
              </div>
            </React.Fragment>
          );
        })}
      </CardContent>
    </Card>
  );
}
