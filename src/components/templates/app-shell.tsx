"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Eye,
  Home,
  LogOut,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Repeat2,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { signOutAction } from "@/app/(auth)/actions";
import {
  setViewAsAction,
  switchParishAction,
} from "@/app/(app)/groups/actions";
import { LocaleSwitcher } from "@/components/molecules/locale-switcher";
import { useTheme } from "@/components/providers/theme-provider";
import { TimeZoneProvider } from "@/components/providers/timezone-provider";
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
import { InstallAppButton } from "@/components/molecules/install-app-button";
import { SaintTarcisius } from "@/components/organisms/landing/saint-tarcisius";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useResultError } from "@/hooks/use-error-message";
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
  /** Zone of the active parish: every date below renders on its clock. */
  timeZone: string;
  parishes: ShellParish[];
  personName: string | null;
}

/** Role names in the reader's language, keyed by the role stored in the row. */
function useRoleLabel() {
  const t = useTranslations("shell");
  return React.useCallback((role: Role) => t(`roles.${role}`), [t]);
}

interface NavItem {
  href: string;
  icon: typeof Home;
  /** Key under the `nav` namespace - the label is translated at render time. */
  labelKey: string;
  minRole: Role;
}

const NAV: NavItem[] = [
  { href: "/home", icon: Home, labelKey: "home", minRole: "member" },
  { href: "/my-masses", icon: CalendarDays, labelKey: "myMasses", minRole: "member" },
  { href: "/schedules", icon: Repeat2, labelKey: "schedules", minRole: "coordinator" },
  { href: "/people", icon: Users, labelKey: "people", minRole: "coordinator" },
  { href: "/stats", icon: BarChart3, labelKey: "stats", minRole: "coordinator" },
  { href: "/group", icon: Settings, labelKey: "group", minRole: "admin" },
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
  // Bottom bar: the first three fit; the rest go under "More".
  const primary = items.slice(0, 3);
  const extra = items.slice(3);

  return (
    <TimeZoneProvider timeZone={user.timeZone}>
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
    </TimeZoneProvider>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Group switcher. The menu shows up even with a single group: it is the way
 * the second one gets created, and hiding the path left "add another parish"
 * with no door into the interface.
 */
function ParishSwitcher({ user, className }: { user: ShellUser; className?: string }) {
  const router = useRouter();
  const t = useTranslations("shell");
  const roleLabel = useRoleLabel();
  const resultError = useResultError();
  const [pending, startTransition] = React.useTransition();

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
            <p className="text-xs text-muted-foreground">{roleLabel(user.role)}</p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>
          {t("parishSwitcher.label", { count: user.parishes.length })}
        </DropdownMenuLabel>
        {user.parishes.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() =>
              startTransition(async () => {
                const message = resultError(await switchParishAction(p.id));
                if (message) {
                  toast.error(message);
                  return;
                }
                router.refresh();
              })
            }
          >
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            {p.id === user.parishId ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
        {user.isSuperadmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/groups/new">
                <Plus className="h-4 w-4" />
                {t("parishSwitcher.createGroup")}
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewAsMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  const t = useTranslations("shell");
  const roleLabel = useRoleLabel();
  const [pending, startTransition] = React.useTransition();

  const apply = (role: Role | null) =>
    startTransition(async () => {
      await setViewAsAction(role);
      router.refresh();
    });

  if (user.role !== "admin") return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending} className="gap-2">
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">{t("viewAs.trigger")}</span>
          {user.effectiveRole !== user.role ? (
            <Badge variant="secondary">{roleLabel(user.effectiveRole)}</Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("viewAs.label")}</DropdownMenuLabel>
        {(["admin", "coordinator", "member"] as Role[]).map((r) => (
          <DropdownMenuItem key={r} onSelect={() => apply(r === "admin" ? null : r)}>
            <span className="flex-1">{roleLabel(r)}</span>
            {user.effectiveRole === r ? <Check className="h-4 w-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const t = useTranslations("shell");
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={t("theme.toggle")}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

function SignOutButton() {
  const t = useTranslations("shell");
  return (
    <form action={signOutAction}>
      <Button variant="ghost" size="icon" type="submit" aria-label={t("signOut")}>
        <LogOut className="h-4 w-4" />
      </Button>
    </form>
  );
}

const COLLAPSE_KEY = "altar:sidebar-collapsed";

/**
 * Collapsed state of the sidebar, remembered per device.
 *
 * localStorage is only read after mounting - on the server it does not exist,
 * and reading it during render would break hydration. So the sidebar is born
 * expanded and adjusts right afterwards.
 */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is an external system
      if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      // storage blocked - stays expanded
    }
  }, []);

  const toggle = React.useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
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
  const t = useTranslations("shell");
  const tNav = useTranslations("nav");
  const { collapsed, toggle } = useSidebarCollapsed();
  const toggleLabel = collapsed ? t("sidebar.expand") : t("sidebar.collapse");

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* The control lives at the top: in the footer it fights for space with
          Next's development overlay and with the system bar on desktop. */}
      <div
        className={cn(
          "flex h-14 items-center gap-2",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        {!collapsed ? (
          <>
            <SaintTarcisius variant="compact" className="h-6 w-6 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-semibold tracking-tight">
              {t("brand.short")}
            </span>
          </>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{toggleLabel}</TooltipContent>
        </Tooltip>
      </div>
      <Separator />

      {!collapsed ? (
        <>
          <div className="px-2 py-2">
            <ParishSwitcher user={user} />
          </div>
          <Separator />
        </>
      ) : null}

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => {
          const Icon = item.icon;
          const label = tNav(item.labelKey);
          const active = isActive(pathname, item.href);
          const link = (
            <Link
              key={item.href}
              href={item.href}
              aria-label={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md py-2 text-sm transition-colors",
                collapsed ? "justify-center px-2" : "px-3",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span className="truncate">{label}</span> : null}
            </Link>
          );

          // Collapsed, the icon alone says nothing: the name comes in the tooltip.
          return collapsed ? (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      <Separator />
      <div className={cn("space-y-2 p-2", collapsed && "flex flex-col items-center")}>
        {!collapsed ? <InstallAppButton className="w-full justify-start" /> : null}
        {!collapsed ? (
          <div className="px-2">
            <p className="truncate text-sm font-medium">
              {user.personName ?? user.displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        ) : null}
        <div
          className={cn(
            "flex items-center",
            collapsed ? "flex-col gap-1" : "justify-between",
          )}
        >
          <ThemeToggle />
          <LocaleSwitcher />
          {!collapsed ? <ViewAsMenu user={user} /> : null}
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}

function MobileTopBar({ user }: { user: ShellUser }) {
  return (
    <div className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <SaintTarcisius variant="compact" className="h-5 w-5 shrink-0" />
        <span className="truncate text-sm font-semibold">{user.parishName}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ViewAsMenu user={user} />
        <LocaleSwitcher />
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
  const t = useTranslations("shell");
  const tNav = useTranslations("nav");

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
            <span className="max-w-full truncate px-1">{tNav(item.labelKey)}</span>
          </Link>
        );
      })}
      <Sheet>
        <SheetTrigger asChild>
          <button className="tap-target flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
            {tNav("more")}
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{tNav("menu")}</SheetTitle>
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
                  {tNav(item.labelKey)}
                </Link>
              );
            })}
            <Separator className="my-2" />
            <InstallAppButton className="w-full justify-start px-3" />
            <Separator className="my-2" />
            <form action={signOutAction}>
              <button
                type="submit"
                className="tap-target flex w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
                {t("signOut")}
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
