import Link from "next/link";
import { Church } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight"
      >
        <Church className="h-5 w-5 text-primary" />
        Escala de Acólitos
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
