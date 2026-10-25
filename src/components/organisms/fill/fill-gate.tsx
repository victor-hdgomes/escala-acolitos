import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";

import { CopyValue } from "@/components/molecules/copy-value";
import { StandaloneShell } from "@/components/templates/standalone-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * What a members-only schedule shows to someone who cannot answer it yet.
 *
 * Two different people arrive here and they need different things, so the
 * screen says which case it is rather than refusing twice over: a visitor
 * with no account needs the sign-up button, and someone already signed in
 * needs their join code to hand to the coordinator.
 */
export async function FillGate({
  parishName,
  token,
  joinCode,
}: {
  parishName: string;
  token: string;
  /** Present when someone is signed in but not in this group. */
  joinCode: string | null;
}) {
  const t = await getTranslations("fill.gate");

  return (
    <StandaloneShell art="hero">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            {t("title")}
          </CardTitle>
          <CardDescription>
            {t("description", { group: parishName })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {joinCode ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("codeHelp", { group: parishName })}
              </p>
              <CopyValue value={joinCode} variant="code" />
              <Button asChild variant="outline" className="w-full">
                <Link href="/pending">{t("pendingCta")}</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild className="w-full">
                <Link href="/signup">{t("signUpCta")}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/login?redirect=/e/${token}`}>
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
