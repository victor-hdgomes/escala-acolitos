import { NextResponse } from "next/server";

/**
 * Manifesto mínimo: o app é instalável no celular, que é onde ele vive.
 * Sem ícones próprios ainda — o navegador cai no favicon.
 */
export function GET() {
  return NextResponse.json({
    name: "Escala de Acólitos",
    short_name: "Escala",
    description:
      "Escala do ministério de acólitos: disponibilidade por link, montagem e substituição.",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "pt-BR",
    orientation: "portrait",
  });
}
