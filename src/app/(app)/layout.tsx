import { AppShell, type ShellUser } from "@/components/templates/app-shell";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireSession();

  const user: ShellUser = {
    displayName: ctx.displayName,
    email: ctx.email,
    isSuperadmin: ctx.isSuperadmin,
    role: ctx.role,
    effectiveRole: ctx.effectiveRole,
    parishId: ctx.parish.id,
    parishName: ctx.parish.name,
    parishes: ctx.memberships.map((m) => ({
      id: m.parish.id,
      name: m.parish.name,
      role: m.role,
    })),
    personName: ctx.person?.full_name ?? null,
  };

  return <AppShell user={user}>{children}</AppShell>;
}
