"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";

import {
  addAccountToGroupAction,
  findAccountAction,
  type FoundAccount,
} from "@/app/(app)/groups/actions";
import { FormSelect } from "@/components/molecules/form-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type { Role } from "@/lib/db/types";

/** Every role, from the least access to the most: the order pickers show. */
const ROLES: Role[] = ["member", "coordinator", "admin"];

/** A name already on the altar servers list, for the "link to" picker. */
export interface LinkablePerson {
  id: string;
  full_name: string;
  claimed: boolean;
}

/**
 * The other half of the waiting screen.
 *
 * Someone signs up, lands with no group and reads their join code out to
 * whoever coordinates. That person types it here, sees who it belongs to and
 * adds them. Nothing is searchable: the code or the full address has to be
 * handed over first, so this never becomes a way to browse accounts.
 */
export function AddMemberCard({ people }: { people: LinkablePerson[] }) {
  const router = useRouter();
  const t = useTranslations("group.addMember");
  const roleLabel = useTranslations("group.roles");
  const resultError = useResultError();

  const [query, setQuery] = React.useState("");
  const [found, setFound] = React.useState<FoundAccount | null>(null);
  const [role, setRole] = React.useState<Role>("member");
  const [personId, setPersonId] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const unclaimed = people.filter((p) => !p.claimed);

  function search() {
    startTransition(async () => {
      const result = await findAccountAction(query);
      const message = resultError(result);
      if (message) {
        setFound(null);
        toast.error(message);
        return;
      }
      const account = result.ok ? (result.data ?? null) : null;
      setFound(account);
      // A sensible starting point for the name link, so the common case is
      // one more click: the account's own display name.
      setNewName(account?.displayName ?? "");
      setPersonId("");
    });
  }

  function add() {
    if (!found) return;
    startTransition(async () => {
      const message = resultError(
        await addAccountToGroupAction({
          userId: found.userId,
          role,
          personId: personId || null,
          personName: personId ? null : newName,
        }),
      );
      if (message) {
        toast.error(message);
        return;
      }
      toast.success(t("added", { name: found.displayName }));
      setFound(null);
      setQuery("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="h-4 w-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="find-account">{t("queryLabel")}</Label>
          <div className="flex gap-2">
            <Input
              id="find-account"
              value={query}
              placeholder={t("queryPlaceholder")}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                search();
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending || !query.trim()}
              onClick={search}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {t("find")}
            </Button>
          </div>
        </div>

        {found ? (
          <div className="space-y-4 rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">{found.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {found.email ?? t("noEmail")}
              </p>
            </div>

            {found.alreadyMember ? (
              <Alert>
                <AlertDescription>{t("alreadyMember")}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="add-role">{t("roleLabel")}</Label>
                  <FormSelect
                    id="add-role"
                    name="role"
                    defaultValue={role}
                    options={ROLES.map((r) => ({
                      value: r,
                      label: roleLabel(r),
                    }))}
                    onValueChange={(value) => setRole(value as Role)}
                  />
                </div>

                {found.personId ? (
                  <p className="text-xs text-muted-foreground">
                    {t("alreadyLinked")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="add-person">{t("personLabel")}</Label>
                    {unclaimed.length ? (
                      <select
                        id="add-person"
                        className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                        value={personId}
                        onChange={(e) => setPersonId(e.target.value)}
                      >
                        <option value="">{t("personNew")}</option>
                        {unclaimed.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {personId ? null : (
                      <Input
                        value={newName}
                        placeholder={t("personNamePlaceholder")}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t("personHelp")}
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full"
                  disabled={pending}
                  onClick={add}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {t("add")}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
