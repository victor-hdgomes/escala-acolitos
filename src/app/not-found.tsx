import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Church } from "lucide-react";

import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("shell");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <Church className="mb-4 h-6 w-6 text-primary" />
      <h1 className="text-lg font-semibold tracking-tight">
        {t("notFound.title")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("notFound.description")}
      </p>
      <Button asChild className="mt-6">
        <Link href="/">{t("notFound.action")}</Link>
      </Button>
    </div>
  );
}
