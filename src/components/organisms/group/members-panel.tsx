"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  changeMemberRoleAction,
  createInviteAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/app/(app)/grupos/actions";
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
import type { ActionResult } from "@/lib/action-result";
import type { Invite, Role } from "@/lib/db/types";
import { isPast } from "@/lib/now";
import { appUrlClient, copyToClipboard } from "@/lib/client-utils";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  coordinator: "Coordenador",
  member: "Acólito",
};

const ROLE_HELP: Record<Role, string> = {
  admin: "Faz tudo: grupo, membros, locais, grade e escalas.",
  coordinator: "Cria e monta escalas. Não mexe na configuração do grupo.",
  member: "Vê a própria escala e pede substituição.",
};

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
  people,
}: {
  members: MemberRow[];
  invites: Invite[];
  people: Array<{ id: string; full_name: string; claimed: boolean }>;
}) {
  return (
    <div className="space-y-4">
      <InviteCard people={people} />
      <MemberList members={members} />
      {invites.length ? <PendingInvites invites={invites} /> : null}
    </div>
  );
}

function InviteCard({
  people,
}: {
  people: Array<{ id: string; full_name: string; claimed: boolean }>;
}) {
  const [state, action] = useActionState<
    ActionResult<{ url: string }> | null,
    FormData
  >(createInviteAction, null);

  React.useEffect(() => {
    if (state?.ok && state.data?.url) {
      toast.success("Convite criado. Link copiado.");
      void copyToClipboard(state.data.url);
    } else if (state && !state.ok) {
      toast.error(state.error);
    }
  }, [state]);

  const unclaimed = people.filter((p) => !p.claimed);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4" />
          Convidar
        </CardTitle>
        <CardDescription>
          Gera um link de entrada. Com e-mail preenchido, o convite também é
          enviado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-role">Papel</Label>
              <FormSelect
                id="invite-role"
                name="role"
                defaultValue="member"
                options={(["member", "coordinator", "admin"] as Role[]).map(
                  (r) => ({ value: r, label: ROLE_LABEL[r] }),
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mail (opcional)</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="pessoa@exemplo.com"
              />
            </div>
          </div>

          {unclaimed.length ? (
            <div className="space-y-2">
              <Label htmlFor="invite-person">Vincular ao acólito (opcional)</Label>
              <FormSelect
                id="invite-person"
                name="personId"
                placeholder="Nenhum"
                options={unclaimed.map((p) => ({
                  value: p.id,
                  label: p.full_name,
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Ao aceitar, a conta já fica ligada a esse nome na escala.
              </p>
            </div>
          ) : null}

          <SubmitButton>Gerar convite</SubmitButton>

          {state?.ok && state.data?.url ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <code className="min-w-0 flex-1 truncate text-xs">
                {state.data.url}
              </code>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  void copyToClipboard(state.data!.url);
                  toast.success("Link copiado");
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
  const [pending, startTransition] = React.useTransition();

  const change = (userId: string, role: Role) =>
    startTransition(async () => {
      const res = await changeMemberRoleAction(userId, role);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Papel atualizado");
        router.refresh();
      }
    });

  const remove = (userId: string, name: string) =>
    startTransition(async () => {
      const res = await removeMemberAction(userId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`${name} saiu do grupo`);
        router.refresh();
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Membros ({members.length})</CardTitle>
        <CardDescription>
          {Object.entries(ROLE_HELP)
            .map(([r, help]) => `${ROLE_LABEL[r as Role]}: ${help}`)
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
                      você
                    </Badge>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.email ?? "sem e-mail"}
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
                  aria-label={`Remover ${m.name}`}
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

function FormSelectRole({
  value,
  disabled,
  onChange,
}: {
  value: Role;
  disabled?: boolean;
  onChange: (role: Role) => void;
}) {
  return (
    <select
      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Role)}
      aria-label="Papel"
    >
      {(["member", "coordinator", "admin"] as Role[]).map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

function PendingInvites({ invites }: { invites: Invite[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Convites pendentes ({invites.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {invites.map((inv, i) => {
          const url = appUrlClient(`/convite/${inv.token}`);
          const expired = isPast(inv.expires_at);
          return (
            <React.Fragment key={inv.id}>
              {i > 0 ? <Separator /> : null}
              <div className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {inv.email ?? "Link aberto"}{" "}
                    <Badge variant="secondary">{ROLE_LABEL[inv.role]}</Badge>
                    {expired ? (
                      <Badge variant="destructive" className="ml-1">
                        expirado
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
                  onClick={() => {
                    void copyToClipboard(url);
                    toast.success("Link copiado");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  aria-label="Revogar convite"
                  onClick={() =>
                    startTransition(async () => {
                      const res = await revokeInviteAction(inv.id);
                      if (!res.ok) toast.error(res.error);
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
