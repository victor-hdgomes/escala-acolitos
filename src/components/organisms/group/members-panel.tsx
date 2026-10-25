"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, Link2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  changeMemberRoleAction,
  createInviteAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/app/(app)/groups/actions";
import { FormSelect } from "@/components/molecules/form-select";
import {
  AddMemberCard,
  type LinkablePerson,
} from "@/components/organisms/group/add-member-card";
import { JoinLinksCard } from "@/components/organisms/group/join-links-card";
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
import type { Invite, JoinLink, Role } from "@/lib/db/types";
import { isPast } from "@/lib/now";
import { appUrlClient, copyToClipboard } from "@/lib/client-utils";

/** Every role, from the least access to the most - the order pickers show. */
const ROLES: Role[] = ["member", "coordinator", "admin"];

/**
 * Role names, translated once for the picker, the badges and the help text.
 *
 * A hook rather than a constant because the names are copy: they live in the
 * catalog and change with the reader's language.
 */
function useRoleLabel() {
  const t = useTranslations("group.roles");
  return React.useCallback((role: Role) => t(role), [t]);
}

export interface MemberRow {
  userId: string;
  role: Role;
  since: string;
  name: string;
  email: string | null;
  isSelf: boolean;
}

export function MembersPanel({
  members,
  invites,
  joinLinks,
  people,
}: {
  members: MemberRow[];
  invites: Invite[];
  joinLinks: JoinLink[];
  people: LinkablePerson[];
}) {
  return (
    <div className="space-y-4">
      <JoinLinksCard links={joinLinks} />
      <AddMemberCard people={people} />
      <InviteCard people={people} />
      <MemberList members={members} />
      {invites.length ? <PendingInvites invites={invites} /> : null}
    </div>
  );
}

function InviteCard({ people }: { people: LinkablePerson[] }) {
  const t = useTranslations("group.members.invite");
  const common = useTranslations("common");
  const roleLabel = useRoleLabel();
  const [url, setUrl] = React.useState<string | null>(null);

  const { onSubmit, pending } = useFormAction(createInviteAction, {
    onSuccess: (data) => {
      if (!data?.url) return;
      setUrl(data.url);
      void copyToClipboard(data.url);
      toast.success(t("created"));
    },
  });

  const unclaimed = people.filter((p) => !p.claimed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-role">{t("roleLabel")}</Label>
              <FormSelect
                id="invite-role"
                name="role"
                defaultValue="member"
                options={ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">{t("emailLabel")}</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder={t("emailPlaceholder")}
              />
            </div>
          </div>

          {unclaimed.length ? (
            <div className="space-y-2">
              <Label htmlFor="invite-person">{t("personLabel")}</Label>
              <FormSelect
                id="invite-person"
                name="personId"
                placeholder={t("personPlaceholder")}
                options={unclaimed.map((p) => ({
                  value: p.id,
                  label: p.full_name,
                }))}
              />
              <p className="text-xs text-muted-foreground">{t("personHelp")}</p>
            </div>
          ) : null}

          <SubmitButton pending={pending}>{t("submit")}</SubmitButton>

          {url ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <code className="min-w-0 flex-1 truncate text-xs">{url}</code>
              <Button
                type="button"
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
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function MemberList({ members }: { members: MemberRow[] }) {
  const router = useRouter();
  const t = useTranslations("group.members.list");
  const common = useTranslations("common");
  const help = useTranslations("group.roleHelp");
  const roleLabel = useRoleLabel();
  const resultError = useResultError();
  const [pending, startTransition] = React.useTransition();

  const change = (userId: string, role: Role) =>
    startTransition(async () => {
      const message = resultError(await changeMemberRoleAction(userId, role));
      if (message) {
        toast.error(message);
        return;
      }
      toast.success(t("roleUpdated"));
      router.refresh();
    });

  const remove = (userId: string, name: string) =>
    startTransition(async () => {
      const message = resultError(await removeMemberAction(userId));
      if (message) {
        toast.error(message);
        return;
      }
      toast.success(t("removed", { name }));
      router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("title", { count: members.length })}
        </CardTitle>
        <CardDescription>
          {/* Most access first: the description reads as a ladder downwards. */}
          {[...ROLES]
            .reverse()
            .map((r) => `${roleLabel(r)}: ${help(r)}`)
            .join(" ")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {members.map((m, i) => (
          <React.Fragment key={m.userId}>
            {i > 0 ? <Separator /> : null}
            <div className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.name}
                  {m.isSelf ? (
                    <Badge variant="secondary" className="ml-2">
                      {common("you")}
                    </Badge>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.email ?? t("noEmail")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <FormSelectRole
                  value={m.role}
                  disabled={pending}
                  onChange={(role) => change(m.userId, role)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  aria-label={t("remove", { name: m.name })}
                  onClick={() => remove(m.userId, m.name)}
                >
                  <Trash2 className="h-4 w-4 text-[color:var(--color-open)]" />
                </Button>
              </div>
            </div>
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * A native `<select>`, not the styled one: it sits inside a dense row and
 * changes a role on pick, with no form and no submit button around it.
 */
function FormSelectRole({
  value,
  disabled,
  onChange,
}: {
  value: Role;
  disabled?: boolean;
  onChange: (role: Role) => void;
}) {
  const t = useTranslations("group");
  const roleLabel = useRoleLabel();

  return (
    <select
      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Role)}
      aria-label={t("roleFieldLabel")}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {roleLabel(r)}
        </option>
      ))}
    </select>
  );
}

function PendingInvites({ invites }: { invites: Invite[] }) {
  const router = useRouter();
  const t = useTranslations("group.members.pending");
  const common = useTranslations("common");
  const roleLabel = useRoleLabel();
  const resultError = useResultError();
  const [pending, startTransition] = React.useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("title", { count: invites.length })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {invites.map((inv, i) => {
          const url = appUrlClient(`/invite/${inv.token}`);
          const expired = isPast(inv.expires_at);
          return (
            <React.Fragment key={inv.id}>
              {i > 0 ? <Separator /> : null}
              <div className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {inv.email ?? t("openLink")}{" "}
                    <Badge variant="secondary">{roleLabel(inv.role)}</Badge>
                    {expired ? (
                      <Badge variant="destructive" className="ml-1">
                        {t("expired")}
                      </Badge>
                    ) : null}
                  </p>
                  <code className="block truncate text-xs text-muted-foreground">
                    {url}
                  </code>
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
                  aria-label={t("revoke")}
                  onClick={() =>
                    startTransition(async () => {
                      const message = resultError(
                        await revokeInviteAction(inv.id),
                      );
                      if (message) toast.error(message);
                      else router.refresh();
                    })
                  }
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
