import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Church } from "lucide-react";

import { NewParishForm } from "@/components/organisms/groups/new-parish-form";
import { Button } from "@/components/ui/button";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Novo grupo" };

/**
 * Fica fora do layout `(app)` de propósito: quem chega aqui pode ainda não
 * pertencer a grupo nenhum, e o layout do app exige um.
 */
export default async function NewParishPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/grupos/novo");

  const ctx = await getSessionContext();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Church className="h-5 w-5 text-primary" />
        {ctx ? "Criar outro grupo" : "Criar seu grupo"}
      </div>
      {!ctx ? (
        <p className="mb-6 text-sm text-muted-foreground">
          Sua conta ainda não participa de nenhum grupo. Crie o seu — ou peça o
          link de convite a quem administra.
        </p>
      ) : null}
      <NewParishForm />
      {ctx ? (
        <Button variant="ghost" asChild className="mt-4">
          <Link href="/inicio">Voltar</Link>
        </Button>
      ) : null}
    </div>
  );
}
