"use client";

import * as React from "react";
import { Lock, Search, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PickablePerson {
  id: string;
  name: string;
  claimed: boolean;
  isMe: boolean;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Escolha do nome. É a primeira coisa que o acólito faz, num formulário sem
 * login — por isso busca por acento-insensível e alvo de toque grande.
 *
 * Nome com conta vinculada aparece com cadeado: continua visível (para a
 * pessoa saber que está lá), mas só o dono da conta consegue selecionar.
 */
export function PersonPicker({
  people,
  value,
  onChange,
  open,
  onOpenChange,
}: {
  people: PickablePerson[];
  value: PickablePerson | null;
  onChange: (person: PickablePerson) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = normalize(query.trim());
    const list = q
      ? people.filter((p) => normalize(p.name).includes(q))
      : people;
    // Quem está logado vê o próprio nome no topo.
    return [...list].sort((a, b) => Number(b.isMe) - Number(a.isMe));
  }, [people, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Qual é o seu nome?</DialogTitle>
          <DialogDescription>
            Selecione para marcar suas datas.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar"
              className="pl-9"
              inputMode="search"
            />
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto border-t border-border">
          {filtered.map((person) => {
            const blocked = person.claimed && !person.isMe;
            return (
              <button
                key={person.id}
                type="button"
                disabled={blocked}
                onClick={() => {
                  onChange(person);
                  onOpenChange(false);
                  setQuery("");
                }}
                className={cn(
                  "tap-target flex w-full items-center gap-3 border-b border-border px-4 text-left text-sm last:border-b-0",
                  blocked
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-accent active:bg-accent",
                  value?.id === person.id && "bg-accent",
                )}
              >
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{person.name}</span>
                {person.isMe ? <Badge variant="secondary">você</Badge> : null}
                {blocked ? (
                  <Lock
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-label="Vinculado a uma conta"
                  />
                ) : null}
              </button>
            );
          })}

          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum nome encontrado. Fale com a coordenação para ser incluído.
            </p>
          ) : null}
        </div>

        <div className="border-t border-border p-3">
          <p className="text-center text-xs text-muted-foreground">
            Nome com cadeado está vinculado a uma conta — só o dono marca.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PersonButton({
  person,
  onClick,
}: {
  person: PickablePerson | null;
  onClick: () => void;
}) {
  return (
    <Button
      variant={person ? "outline" : "default"}
      className="w-full justify-start gap-2"
      onClick={onClick}
    >
      <UserRound className="h-4 w-4" />
      <span className="min-w-0 flex-1 truncate text-left">
        {person ? person.name : "Selecione o seu nome"}
      </span>
      <span className="text-xs text-muted-foreground">trocar</span>
    </Button>
  );
}
