import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AcceptInvite } from "@/components/organisms/groups/accept-invite";
import { StandaloneShell } from "@/components/templates/standalone-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/db/types";
import { isPast } from "@/lib/now";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: t("title") };
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [t, roles] = await Promise.all([
    getTranslations("invite"),
    getTranslations("group.roles"),
  ]);

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  const { data: parish } = invite
    ? await admin.from("parishes").select("name").eq("id", invite.parish_id).single()
    : { data: null };
  const { data: person } = invite?.person_id
    ? await admin
        .from("people")
        .select("full_name")
        .eq("id", invite.person_id)
        .eq("parish_id", invite.parish_id)
        .maybeSingle()
    : { data: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const invalid =
    !invite ||
    !!invite.accepted_at ||
    isPast(invite.expires_at);

  return (
    <StandaloneShell art="hero">
      {invalid ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("unavailable.title")}</CardTitle>
            <CardDescription>{t("unavailable.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">{t("unavailable.action")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{parish?.name}</CardTitle>
            <CardDescription>
              {person
                ? t.rich("invitedAsWithPerson", {
                    role: roles(invite.role as Role),
                    name: person.full_name,
                    b: (chunks) => <strong>{chunks}</strong>,
                  })
                : t.rich("invitedAs", {
                    role: roles(invite.role as Role),
                    b: (chunks) => <strong>{chunks}</strong>,
                  })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {user ? (
              <AcceptInvite token={token} />
            ) : (
              <>
                <Button asChild className="w-full">
                  {/* `invite` is the query key the signup page already reads. */}
                  <Link href={`/signup?invite=${token}`}>{t("signUpCta")}</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/login?redirect=/invite/${token}`}>
                    {t("signInCta")}
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </StandaloneShell>
  );
}
