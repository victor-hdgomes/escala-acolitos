import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { JoinWithLink } from "@/components/organisms/groups/join-with-link";
import { StandaloneShell } from "@/components/templates/standalone-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Role } from "@/lib/db/types";
import { resolveJoinLink } from "@/lib/public-access";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("join");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The link a coordinator posts in the group chat.
 *
 * Kept on a one-letter path for the same reason `/e`, `/v` and `/t` are: it
 * gets pasted into WhatsApp, where a long URL wraps and looks like spam.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [context, t, roles] = await Promise.all([
    resolveJoinLink(token),
    getTranslations("join"),
    getTranslations("group.roles"),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!context || context.closedReason) {
    return (
      <StandaloneShell>
        <Card>
          <CardHeader>
            <CardTitle>{t("unavailable.title")}</CardTitle>
            <CardDescription>
              {context
                ? t(`unavailable.${context.closedReason}`)
                : t("unavailable.notFound")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">{t("unavailable.action")}</Link>
            </Button>
          </CardContent>
        </Card>
      </StandaloneShell>
    );
  }

  return (
    <StandaloneShell art="hero">
      <Card>
        <CardHeader>
          <CardTitle>{context.parish.name}</CardTitle>
          <CardDescription>
            {t.rich("invitedAs", {
              role: roles(context.link.role as Role),
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {user ? (
            <JoinWithLink token={token} />
          ) : (
            <>
              <Button asChild className="w-full">
                <Link href={`/signup?join=${token}`}>{t("signUpCta")}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/login?redirect=/j/${token}`}>
                  {t("signInCta")}
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </StandaloneShell>
  );
}
