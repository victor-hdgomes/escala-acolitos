"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardPaste,
  Link2Off,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  deletePersonAction,
  importPeopleAction,
  savePersonAction,
  togglePersonActiveAction,
  unlinkPersonAction,
} from "@/app/(app)/group/actions";
import { SubmitButton } from "@/components/molecules/submit-button";
import { useResultError } from "@/hooks/use-error-message";
import { useFormAction } from "@/hooks/use-form-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export interface PersonRow {
  id: string;
  full_name: string;
  short_name: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  claimed: boolean;
  claimedEmail: string | null;
}

export function PeoplePanel({
  people,
  isAdmin,
}: {
  people: PersonRow[];
  isAdmin: boolean;
  currentPersonId: string | null;
}) {
  const t = useTranslations("people");
  const [query, setQuery] = React.useState("");
  const [onlyInactive, setOnlyInactive] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return people.filter((p) => {
      if (onlyInactive && p.active) return false;
      if (!q) return true;
      return p.full_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .includes(q);
    });
  }, [people, query, onlyInactive]);

  const claimed = people.filter((p) => p.claimed).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("summary", { total: people.length, linked: claimed })}
          </p>
        </div>
        <div className="flex gap-2">
          <ImportDialog />
          <PersonDialog />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={onlyInactive} onCheckedChange={setOnlyInactive} />
          {t("onlyInactive")}
        </label>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("count", { count: filtered.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {filtered.map((person, i) => (
            <React.Fragment key={person.id}>
              {i > 0 ? <Separator /> : null}
              <PersonLine person={person} isAdmin={isAdmin} />
            </React.Fragment>
          ))}
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("emptyState")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function PersonLine({
  person,
  isAdmin,
}: {
  person: PersonRow;
  isAdmin: boolean;
}) {
  const t = useTranslations("people");
  const resultError = useResultError();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          {person.full_name}
          {person.claimed ? (
            <Lock
              className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-filled)]"
              aria-label={t("row.linkedAccount")}
            />
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {person.claimed
            ? (person.claimedEmail ?? t("row.linkedAccountUnknown"))
            : (person.email ?? t("row.noAccount"))}
        </p>
      </div>
      {!person.active ? (
        <Badge variant="secondary">{t("row.inactive")}</Badge>
      ) : null}
      <Switch
        checked={person.active}
        disabled={pending}
        aria-label={t("row.activeToggle")}
        onCheckedChange={(checked) =>
          startTransition(async () => {
            const message = resultError(
              await togglePersonActiveAction(person.id, checked),
            );
            if (message) toast.error(message);
            else router.refresh();
          })
        }
      />
      <PersonDialog person={person} />
      {isAdmin && person.claimed ? (
        <Button
          size="icon"
          variant="ghost"
          disabled={pending}
          aria-label={t("row.unlink")}
          onClick={() =>
            startTransition(async () => {
              const message = resultError(await unlinkPersonAction(person.id));
              if (message) toast.error(message);
              else {
                toast.success(t("row.unlinked"));
                router.refresh();
              }
            })
          }
        >
          <Link2Off className="h-4 w-4" />
        </Button>
      ) : null}
      {isAdmin ? (
        <Button
          size="icon"
          variant="ghost"
          disabled={pending}
          aria-label={t("row.delete", { name: person.full_name })}
          onClick={() =>
            startTransition(async () => {
              const message = resultError(await deletePersonAction(person.id));
              if (message) toast.error(message);
              else router.refresh();
            })
          }
        >
          <Trash2 className="h-4 w-4 text-[color:var(--color-open)]" />
        </Button>
      ) : null}
    </div>
  );
}

function PersonDialog({ person }: { person?: PersonRow }) {
  const t = useTranslations("people");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(savePersonAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {person ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("dialog.editAria", { name: person.full_name })}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {tCommon("new")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {person ? t("dialog.editTitle") : t("dialog.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {person ? <input type="hidden" name="id" value={person.id} /> : null}
          <div className="space-y-2">
            <Label htmlFor="p-name">{t("dialog.fullName")}</Label>
            <Input
              id="p-name"
              name="fullName"
              defaultValue={person?.full_name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-short">{t("dialog.shortName")}</Label>
            <Input
              id="p-short"
              name="shortName"
              defaultValue={person?.short_name ?? ""}
              placeholder={tCommon("optional")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-email">{t("dialog.email")}</Label>
              <Input
                id="p-email"
                name="email"
                type="email"
                defaultValue={person?.email ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-phone">{t("dialog.phone")}</Label>
              <Input id="p-phone" name="phone" defaultValue={person?.phone ?? ""} />
            </div>
          </div>
          <SubmitButton pending={pending} className="w-full">
            {tCommon("save")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog() {
  const t = useTranslations("people");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(importPeopleAction, {
    onSuccess: (data) => {
      toast.success(
        data?.added
          ? t("import.added", { count: data.added })
          : t("import.nothingNew"),
      );
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ClipboardPaste className="h-4 w-4" />
          {t("import.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>{t("import.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <textarea
            name="names"
            rows={10}
            required
            className="w-full rounded-md border border-input bg-transparent p-3 text-sm"
            placeholder={t("import.placeholder")}
          />
          <SubmitButton pending={pending} className="w-full">
            <UserCheck className="h-4 w-4" />
            {t("import.trigger")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
