import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { NewParishForm } from "@/components/organisms/groups/new-parish-form";
import { StandaloneShell } from "@/components/templates/standalone-shell";
import { Button } from "@/components/ui/button";
import { canCreateParish, getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("newGroup");
  return { title: t("title") };
}

/**
 * Deliberately outside the `(app)` layout: whoever opens a group does not
 * belong to one yet, and the app layout insists on one.
 *
 * An account that may not create lands on the waiting screen instead of a
 * refusal: being unable to open a group is not a dead end, it only means
 * someone else has to let them in.
 */
export default async function NewParishPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/groups/new");

  const [ctx, canCreate, t] = await Promise.all([
    getSessionContext(),
    canCreateParish(user.id),
    getTranslations("newGroup"),
  ]);
  if (!canCreate) redirect("/pending");

  return (
    <StandaloneShell
      heading={ctx ? t("headingAnother") : t("headingFirst")}
      footer={
        ctx ? (
          <Button variant="ghost" asChild className="w-full">
            <Link href="/home">{t("back")}</Link>
          </Button>
        ) : null
      }
    >
      <NewParishForm />
    </StandaloneShell>
  );
}
