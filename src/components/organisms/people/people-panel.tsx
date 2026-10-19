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
import { toast } from "sonner";

import {
  deletePersonAction,
  importPeopleAction,
  savePersonAction,
  togglePersonActiveAction,
  unlinkPersonAction,
} from "@/app/(app)/grupo/actions";
import { SubmitButton } from "@/components/molecules/submit-button";
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
          <h1 className="text-xl font-semibold tracking-tight">Acólitos</h1>
          <p className="text-sm text-muted-foreground">
            {people.length} no grupo · {claimed} com conta vinculada
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
            placeholder="Buscar nome"
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={onlyInactive} onCheckedChange={setOnlyInactive} />
          Só inativos
        </label>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {filtered.length} {filtered.length === 1 ? "pessoa" : "pessoas"}
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
              Ninguém encontrado.
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
              aria-label="Conta vinculada"
            />
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {person.claimed
            ? (person.claimedEmail ?? "conta vinculada")
            : (person.email ?? "sem conta vinculada")}
        </p>
      </div>
      {!person.active ? <Badge variant="secondary">inativo</Badge> : null}
      <Switch
        checked={person.active}
        disabled={pending}
        aria-label="Ativo"
        onCheckedChange={(checked) =>
          startTransition(async () => {
            const res = await togglePersonActiveAction(person.id, checked);
            if (!res.ok) toast.error(res.error);
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
          aria-label="Desvincular conta"
          onClick={() =>
            startTransition(async () => {
              const res = await unlinkPersonAction(person.id);
              if (!res.ok) toast.error(res.error);
              else {
                toast.success("Vínculo desfeito");
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
          aria-label={`Excluir ${person.full_name}`}
          onClick={() =>
            startTransition(async () => {
              const res = await deletePersonAction(person.id);
              if (!res.ok) toast.error(res.error);
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
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(savePersonAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {person ? (
          <Button size="icon" variant="ghost" aria-label={`Editar ${person.full_name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{person ? "Editar acólito" : "Novo acólito"}</DialogTitle>
          <DialogDescription>
            O e-mail aqui serve para avisos. Vincular conta é outra coisa — quem
            vincula é a própria pessoa, ou um convite nominal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {person ? <input type="hidden" name="id" value={person.id} /> : null}
          <div className="space-y-2">
            <Label htmlFor="p-name">Nome completo</Label>
            <Input
              id="p-name"
              name="fullName"
              defaultValue={person?.full_name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-short">Como aparece na escala</Label>
            <Input
              id="p-short"
              name="shortName"
              defaultValue={person?.short_name ?? ""}
              placeholder="opcional"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-email">E-mail</Label>
              <Input
                id="p-email"
                name="email"
                type="email"
                defaultValue={person?.email ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-phone">Telefone</Label>
              <Input id="p-phone" name="phone" defaultValue={person?.phone ?? ""} />
            </div>
          </div>
          <SubmitButton pending={pending} className="w-full">Salvar</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { onSubmit, pending } = useFormAction(importPeopleAction, {
    onSuccess: (data) => {
      toast.success(
        data?.added
          ? `${data.added} ${data.added === 1 ? "nome adicionado" : "nomes adicionados"}`
          : "Nada novo — todos já estavam na lista",
      );
      setOpen(false);
      router.refresh();
    },
    onError: (message) => toast.error(message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ClipboardPaste className="h-4 w-4" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar nomes</DialogTitle>
          <DialogDescription>
            Cole a lista, um nome por linha. Quem já existe é ignorado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <textarea
            name="names"
            rows={10}
            required
            className="w-full rounded-md border border-input bg-transparent p-3 text-sm"
            placeholder={"Sofia Moreira\nLucas Rabelo\nMaria Eduarda Lucena"}
          />
          <SubmitButton pending={pending} className="w-full">
            <UserCheck className="h-4 w-4" />
            Importar
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
