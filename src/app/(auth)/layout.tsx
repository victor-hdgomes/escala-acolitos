import Link from "next/link";
import { Church } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("app");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight"
      >
        <Church className="h-5 w-5 text-primary" />
        {t("name")}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
