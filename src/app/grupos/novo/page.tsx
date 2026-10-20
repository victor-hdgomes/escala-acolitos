import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Church, MailQuestion } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { NewParishForm } from "@/components/organisms/groups/new-parish-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionContext, isSuperadmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Novo grupo" };

/**
 * Fica fora do layout `(app)` de propósito: quem chega aqui pode ainda não
 * pertencer a grupo nenhum, e o layout do app exige um.
 *
 * Duas situações caem nesta rota — o dono criando mais um grupo, e a conta
 * recém-criada que ainda não foi convidada. A segunda não pode virar beco sem
 * saída, por isso a tela explica o caminho em vez de só negar.
 */
export default async function NewParishPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/grupos/novo");

  const [ctx, superadmin] = await Promise.all([
    getSessionContext(),
    isSuperadmin(user.id),
  ]);

  if (!superadmin) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Church className="h-5 w-5 text-primary" />
          Escala de Acólitos
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MailQuestion className="h-4 w-4" />
              {ctx ? "Criar grupo é restrito" : "Falta o convite"}
            </CardTitle>
            <CardDescription>
              {ctx
                ? "Novos grupos são criados pelo administrador do sistema. Você continua administrando o seu normalmente."
                : "Sua conta existe, mas ainda não faz parte de nenhum grupo. Peça o link de convite a quem coordena o seu ministério — ao abrir, você entra direto."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ctx ? (
              <Button asChild className="w-full">
                <Link href="/inicio">Voltar ao início</Link>
              </Button>
            ) : (
              <form action={signOutAction}>
                <Button type="submit" variant="outline" className="w-full">
                  Sair
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Church className="h-5 w-5 text-primary" />
        {ctx ? "Criar outro grupo" : "Criar seu grupo"}
      </div>
      <NewParishForm />
      {ctx ? (
        <Button variant="ghost" asChild className="mt-4">
          <Link href="/inicio">Voltar</Link>
        </Button>
      ) : null}
    </div>
  );
}
