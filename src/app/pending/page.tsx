import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { signOutAction } from "@/app/(auth)/actions";
import { PendingPanel } from "@/components/organisms/groups/pending-panel";
import { StandaloneShell } from "@/components/templates/standalone-shell";
import { Button } from "@/components/ui/button";
import { canCreateParish, getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pending");
  return { title: t("title") };
}

/**
 * Signed in, but in no group yet.
 *
 * Deliberately not a refusal and deliberately not the "open a group" form:
 * most people who reach this are altar servers whose coordinator has not
 * added them, and the screen's job is to hand them the two things that end
 * the wait, a link to paste and a code to read out.
 */
export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/pending");

  // Already in a group: nothing is pending, so this screen would only confuse.
  if (await getSessionContext()) redirect("/home");

  const [{ data: profile }, canCreate, t] = await Promise.all([
    supabase.from("profiles").select("join_code").eq("id", user.id).single(),
    canCreateParish(user.id),
    getTranslations("pending"),
  ]);

  return (
    <StandaloneShell
      art="hero"
      heading={t("heading")}
      description={t("description")}
      footer={
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" className="w-full">
            {t("signOut")}
          </Button>
        </form>
      }
    >
      <PendingPanel
        joinCode={profile?.join_code ?? ""}
        email={user.email ?? null}
        canCreateGroup={canCreate}
      />
    </StandaloneShell>
  );
}
