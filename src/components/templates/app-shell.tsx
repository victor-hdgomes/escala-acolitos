"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Church,
  Eye,
  Home,
  LogOut,
  Moon,
  MoreHorizontal,
  Plus,
  Repeat2,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { signOutAction } from "@/app/(auth)/actions";
import { switchParishAction } from "@/app/(app)/grupos/actions";
import { setViewAsAction } from "@/app/(app)/grupos/actions";
import { useTheme } from "@/components/providers/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Role } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export interface ShellParish {
  id: string;
  name: string;
  role: Role;
}

export interface ShellUser {
  displayName: string;
  email: string | null;
  isSuperadmin: boolean;
  role: Role;
  effectiveRole: Role;
  parishId: string;
  parishName: string;
  parishes: ShellParish[];
  personName: string | null;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  coordinator: "Coordenador",
  member: "Acólito",
};

interface NavItem {
  href: string;
  icon: typeof Home;
  label: string;
  minRole: Role;
}

const NAV: NavItem[] = [
  { href: "/inicio", icon: Home, label: "Início", minRole: "member" },
  { href: "/minhas-missas", icon: CalendarDays, label: "Minhas missas", minRole: "member" },
  { href: "/escalas", icon: Repeat2, label: "Escalas", minRole: "coordinator" },
  { href: "/pessoas", icon: Users, label: "Acólitos", minRole: "coordinator" },
  { href: "/estatisticas", icon: BarChart3, label: "Estatísticas", minRole: "coordinator" },
  { href: "/grupo", icon: Settings, label: "Grupo", minRole: "admin" },
];

const RANK: Record<Role, number> = { member: 0, coordinator: 1, admin: 2 };

function visibleNav(role: Role): NavItem[] {
  return NAV.filter((item) => RANK[role] >= RANK[item.minRole]);
}

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = visibleNav(user.effectiveRole);
  // Barra inferior: as três primeiras cabem; o resto vai para "Mais".
  const primary = items.slice(0, 3);
  const extra = items.slice(3);

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <DesktopSidebar user={user} items={items} pathname={pathname} />
      <main className="flex-1 pb-24 md:pb-0">
        <MobileTopBar user={user} />
        <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
          {children}
        </div>
      </main>
      <BottomNav primary={primary} extra={extra} pathname={pathname} user={user} />
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Troca de grupo. O menu aparece mesmo com um grupo só: é por ele que se
 * cria o segundo, e esconder o caminho deixava "adicionar outra paróquia"
 * sem porta de entrada na interface.
 */
function ParishSwitcher({ user, className }: { user: ShellUser; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const single = user.parishes.length <= 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn("h-auto w-full justify-start px-2 py-1.5 text-left", className)}
          disabled={pending}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.parishName}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>
          {single ? "Seu grupo" : "Seus grupos"}
        </DropdownMenuLabel>
        {user.parishes.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() =>
              startTransition(async () => {
                const res = await switchParishAction(p.id);
                if (!res.ok) toast.error(res.error);
                else router.refresh();
              })
            }
          >
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            {p.id === user.parishId ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/grupos/novo">
            <Plus className="h-4 w-4" />
            Criar novo grupo
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewAsMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  if (user.role !== "admin") return null;

  const apply = (role: Role | null) =>
    startTransition(async () => {
      await setViewAsAction(role);
      router.refresh();
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending} className="gap-2">
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">Ver como</span>
          {user.effectiveRole !== user.role ? (
            <Badge variant="secondary">{ROLE_LABEL[user.effectiveRole]}</Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Ver o app como</DropdownMenuLabel>
        {(["admin", "coordinator", "member"] as Role[]).map((r) => (
          <DropdownMenuItem key={r} onSelect={() => apply(r === "admin" ? null : r)}>
            <span className="flex-1">{ROLE_LABEL[r]}</span>
            {user.effectiveRole === r ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Alternar tema"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

function DesktopSidebar({
  user,
  items,
  pathname,
}: {
  user: ShellUser;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2 px-4">
        <Church className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">Escala</span>
      </div>
      <Separator />
      <div className="px-2 py-2">
        <ParishSwitcher user={user} />
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div className="space-y-2 p-2">
        <div className="px-2">
          <p className="truncate text-sm font-medium">
            {user.personName ?? user.displayName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <ViewAsMenu user={user} />
          <form action={signOutAction}>
            <Button variant="ghost" size="icon" type="submit" aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function MobileTopBar({ user }: { user: ShellUser }) {
  return (
    <div className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <Church className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate text-sm font-semibold">{user.parishName}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ViewAsMenu user={user} />
        <ThemeToggle />
      </div>
    </div>
  );
}

function BottomNav({
  primary,
  extra,
  pathname,
  user,
}: {
  primary: NavItem[];
  extra: NavItem[];
  pathname: string;
  user: ShellUser;
}) {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-background/95 backdrop-blur md:hidden">
      {primary.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "tap-target flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px]",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate px-1">{item.label}</span>
          </Link>
        );
      })}
      <Sheet>
        <SheetTrigger asChild>
          <button className="tap-target flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
            Mais
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="space-y-1 px-4 pb-6">
            <div className="pb-2">
              <ParishSwitcher user={user} />
            </div>
            <Separator className="my-2" />
            {extra.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="tap-target flex items-center gap-3 rounded-md px-3 text-sm"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </Link>
              );
            })}
            <Separator className="my-2" />
            <form action={signOutAction}>
              <button
                type="submit"
                className="tap-target flex w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
