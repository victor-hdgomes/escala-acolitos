import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { GeneralPanel } from "@/components/organisms/group/general-panel";
import { LocationsPanel } from "@/components/organisms/group/locations-panel";
import { MembersPanel } from "@/components/organisms/group/members-panel";
import { TemplatesPanel } from "@/components/organisms/group/templates-panel";
import {
  ScrollTabsList,
  ScrollTabsTrigger,
} from "@/components/molecules/scroll-tabs";
import { TimeZoneProvider } from "@/components/providers/timezone-provider";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth";
import type {
  Invite,
  JoinLink,
  Location,
  MassTemplate,
  Person,
  Role,
} from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("group");
  return { title: t("title") };
}

/** The tabs a link may name. Anything else falls back to the first one. */
const TABS = ["members", "locations", "templates", "general"] as const;
type GroupTab = (typeof TABS)[number];

export default async function GroupPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab: GroupTab = TABS.includes(tab as GroupTab)
    ? (tab as GroupTab)
    : "members";

  const ctx = await requireAdmin();
  const admin = createAdminClient();
  const [t, locale] = await Promise.all([getTranslations("group"), getLocale()]);

  const [
    { data: memberships },
    { data: invites },
    { data: joinLinks },
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
      .from("join_links")
      .select("*")
      .eq("parish_id", ctx.parish.id)
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

  // Under RLS `profiles` is readable only by its own owner - listing the
  // group's members has to read with the service role, admin already checked.
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
        "-",
      email: profileById.get(m.user_id)?.email ?? null,
      isSelf: m.user_id === ctx.userId,
    }))
    // Sorted in the reader's language: accents collate differently per locale.
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <TimeZoneProvider timeZone={ctx.parish.timezone}>
      <div className="space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </header>

        <Tabs defaultValue={activeTab}>
          <ScrollTabsList>
            <ScrollTabsTrigger value="members">
              {t("tabs.members")}
            </ScrollTabsTrigger>
            <ScrollTabsTrigger value="locations">
              {t("tabs.locations")}
            </ScrollTabsTrigger>
            <ScrollTabsTrigger value="templates">
              {t("tabs.templates")}
            </ScrollTabsTrigger>
            <ScrollTabsTrigger value="general">
              {t("tabs.general")}
            </ScrollTabsTrigger>
          </ScrollTabsList>

          <TabsContent value="members" className="mt-4">
            <MembersPanel
              members={members}
              invites={(invites ?? []) as Invite[]}
              joinLinks={(joinLinks ?? []) as JoinLink[]}
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
    </TimeZoneProvider>
  );
}
