import type { Metadata } from "next";

import { GeneralPanel } from "@/components/organisms/group/general-panel";
import { LocationsPanel } from "@/components/organisms/group/locations-panel";
import { MembersPanel } from "@/components/organisms/group/members-panel";
import { TemplatesPanel } from "@/components/organisms/group/templates-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth";
import type { Invite, Location, MassTemplate, Person, Role } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Grupo" };

export default async function GroupPage() {
  const ctx = await requireAdmin();
  const admin = createAdminClient();

  const [
    { data: memberships },
    { data: invites },
    { data: locations },
    { data: templates },
    { data: people },
  ] = await Promise.all([
    admin
      .from("memberships")
      .select("user_id, role, created_at")
      .eq("parish_id", ctx.parish.id),
    admin
      .from("invites")
      .select("*")
      .eq("parish_id", ctx.parish.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("locations")
      .select("*")
      .eq("parish_id", ctx.parish.id)
      .order("sort_order", { ascending: true }),
    admin
      .from("mass_templates")
      .select("*")
      .eq("parish_id", ctx.parish.id)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true }),
    admin
      .from("people")
      .select("*")
      .eq("parish_id", ctx.parish.id)
      .order("full_name", { ascending: true }),
  ]);

  // `profiles` só é legível pelo próprio dono via RLS — para listar os membros
  // do grupo a leitura precisa ser com service role, já com admin confirmado.
  const userIds = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await admin
        .from("profiles")
        .select("id, display_name, email")
        .in("id", userIds)
    : { data: [] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const peopleRows = (people ?? []) as Person[];
  const personByUser = new Map(
    peopleRows.filter((p) => p.claimed_by).map((p) => [p.claimed_by!, p]),
  );

  const members = (memberships ?? [])
    .map((m) => ({
      userId: m.user_id,
      role: m.role as Role,
      since: m.created_at,
      name:
        personByUser.get(m.user_id)?.full_name ??
        profileById.get(m.user_id)?.display_name ??
        "—",
      email: profileById.get(m.user_id)?.email ?? null,
      isSelf: m.user_id === ctx.userId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Grupo</h1>
        <p className="text-sm text-muted-foreground">
          Quem administra, onde se celebra e qual é a grade da semana.
        </p>
      </header>

      <Tabs defaultValue="members">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="locations">Locais</TabsTrigger>
          <TabsTrigger value="templates">Grade</TabsTrigger>
          <TabsTrigger value="general">Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <MembersPanel
            members={members}
            invites={(invites ?? []) as Invite[]}
            people={peopleRows.map((p) => ({
              id: p.id,
              full_name: p.full_name,
              claimed: !!p.claimed_by,
            }))}
          />
        </TabsContent>

        <TabsContent value="locations" className="mt-4">
          <LocationsPanel locations={(locations ?? []) as Location[]} />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplatesPanel
            templates={(templates ?? []) as MassTemplate[]}
            locations={(locations ?? []) as Location[]}
          />
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <GeneralPanel parish={ctx.parish} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
