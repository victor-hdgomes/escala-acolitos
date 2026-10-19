import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck2,
  Church,
  Filter,
  Repeat2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  {
    icon: Filter,
    title: "Preenchimento em um toque",
    text: "O acólito abre o link, escolhe o nome e marca todos os domingos de manhã de uma vez. Sem conta, sem senha.",
  },
  {
    icon: Users,
    title: "Você vê quem respondeu",
    text: "Quem marcou, quem sumiu, quem serve demais e quem nunca é escalado. O formulário não conta isso; aqui conta.",
  },
  {
    icon: CalendarCheck2,
    title: "Montagem com sugestão",
    text: "A escolha continua sendo sua — o sistema só põe na frente quem está em falta de escala e sem conflito no dia.",
  },
  {
    icon: Repeat2,
    title: "Substituição que se resolve",
    text: "\"Não vou conseguir\" gera um link. Primeiro que clica assume, e a escala se atualiza sozinha.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/inicio");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <div className="mb-10 flex items-center gap-2">
        <Church className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">Escala de Acólitos</span>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        A escala do ministério sem planilha e sem perder nada no grupo.
      </h1>
      <p className="mt-4 text-base text-muted-foreground text-pretty">
        Crie a escala do mês, mande um link no WhatsApp e deixe o pessoal
        preencher pelo celular. Novena, estatísticas e substituição inclusas.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/signup">
            Criar meu grupo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login">Entrar</Link>
        </Button>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Recebeu um link do seu coordenador? É só abrir — não precisa de conta.
      </p>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.title}>
              <CardContent className="space-y-2 py-5">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-semibold">{f.title}</h2>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
