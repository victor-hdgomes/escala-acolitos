import type { Metadata } from "next";
import Link from "next/link";
import { Church } from "lucide-react";

import { AcceptInvite } from "@/components/organisms/groups/accept-invite";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/auth";
import type { Role } from "@/lib/db/types";
import { isPast } from "@/lib/now";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Convite" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

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
    ? await admin.from("people").select("full_name").eq("id", invite.person_id).single()
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
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Church className="h-5 w-5 text-primary" />
        Escala de Acólitos
      </div>

      {invalid ? (
        <Card>
          <CardHeader>
            <CardTitle>Convite indisponível</CardTitle>
            <CardDescription>
              Este convite já foi usado ou expirou. Peça um novo a quem
              administra o grupo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Ir para o login</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{parish?.name}</CardTitle>
            <CardDescription>
              Você foi convidado(a) como{" "}
              <strong>{ROLE_LABEL[invite.role as Role]}</strong>
              {person ? (
                <>
                  , vinculado ao nome <strong>{person.full_name}</strong>
                </>
              ) : null}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {user ? (
              <AcceptInvite token={token} />
            ) : (
              <>
                <Button asChild className="w-full">
                  <Link href={`/signup?convite=${token}`}>
                    Criar conta e aceitar
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/login?redirect=/convite/${token}`}>
                    Já tenho conta
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
