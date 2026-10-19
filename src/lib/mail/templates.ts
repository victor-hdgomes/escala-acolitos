import "server-only";

import { formatShortDate, formatTime, monthLabel, weekdayLong } from "@/lib/date";

/**
 * HTML inline e tabelado de propósito: cliente de e-mail ignora boa parte do
 * CSS moderno, e Gmail no celular é onde isso vai ser lido.
 */
function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#171717">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:18px;line-height:1.3">${title}</h1>
      ${body}
      <p style="margin:24px 0 0;font-size:12px;color:#737373">Ministério de Acólitos · mensagem automática</p>
    </td></tr>
  </table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${label}</a></p>`;
}

export interface MassLine {
  starts_at: string;
  locationName: string;
  label: string | null;
}

function massList(items: MassLine[], timezone: string): string {
  if (!items.length) return "<p>Nenhuma celebração.</p>";
  const rows = items
    .map(
      (m) =>
        `<li style="margin:0 0 10px;line-height:1.5"><strong>${weekdayLong(m.starts_at, timezone)}, ${formatShortDate(m.starts_at, timezone)} às ${formatTime(m.starts_at, timezone)}</strong><br>${m.locationName}${m.label ? ` — ${m.label}` : ""}</li>`,
    )
    .join("");
  return `<ul style="margin:0;padding-left:18px">${rows}</ul>`;
}

export function schedulePublishedEmail({
  personName,
  month,
  masses,
  timezone,
  url,
}: {
  personName: string;
  month: string;
  masses: MassLine[];
  timezone: string;
  url: string;
}): { subject: string; html: string } {
  return {
    subject: `Suas missas de ${monthLabel(month).toLowerCase()}`,
    html: layout(
      `Olá, ${personName}! A escala de ${monthLabel(month).toLowerCase()} saiu.`,
      `<p style="margin:0 0 12px">Você está escalado(a) em:</p>
       ${massList(masses, timezone)}
       ${button(url, "Ver a escala completa")}
       <p style="margin:0;font-size:13px;color:#525252">Se não puder em alguma data, peça substituição pelo próprio link.</p>`,
    ),
  };
}

export function reminderEmail({
  personName,
  masses,
  timezone,
  url,
}: {
  personName: string;
  masses: MassLine[];
  timezone: string;
  url: string;
}): { subject: string; html: string } {
  return {
    subject: "Você serve amanhã",
    html: layout(
      `${personName}, lembrete da sua missa de amanhã`,
      `${massList(masses, timezone)}${button(url, "Ver a escala")}`,
    ),
  };
}

export function swapOpenedEmail({
  personName,
  requesterName,
  starts_at,
  locationName,
  timezone,
  url,
  reason,
}: {
  personName: string;
  requesterName: string;
  starts_at: string;
  locationName: string;
  timezone: string;
  url: string;
  reason: string | null;
}): { subject: string; html: string } {
  return {
    subject: `${requesterName} precisa de substituição`,
    html: layout(
      `${personName}, alguém precisa de substituição`,
      `<p style="margin:0 0 12px"><strong>${requesterName}</strong> não vai conseguir servir
        ${weekdayLong(starts_at, timezone)}, ${formatShortDate(starts_at, timezone)} às ${formatTime(starts_at, timezone)},
        em ${locationName}.</p>
       ${reason ? `<p style="margin:0 0 12px;color:#525252">Motivo: ${reason}</p>` : ""}
       <p style="margin:0 0 12px">Você marcou disponibilidade para esse horário. Pode assumir?</p>
       ${button(url, "Assumir esta vaga")}`,
    ),
  };
}

export function swapFilledEmail({
  personName,
  filledByName,
  starts_at,
  locationName,
  timezone,
}: {
  personName: string;
  filledByName: string;
  starts_at: string;
  locationName: string;
  timezone: string;
}): { subject: string; html: string } {
  return {
    subject: "Sua substituição foi assumida",
    html: layout(
      `${personName}, está resolvido`,
      `<p style="margin:0">
        <strong>${filledByName}</strong> assumiu a sua vaga de
        ${weekdayLong(starts_at, timezone)}, ${formatShortDate(starts_at, timezone)} às ${formatTime(starts_at, timezone)},
        em ${locationName}.</p>`,
    ),
  };
}

export function inviteEmail({
  parishName,
  roleLabel,
  url,
}: {
  parishName: string;
  roleLabel: string;
  url: string;
}): { subject: string; html: string } {
  return {
    subject: `Convite para ${parishName}`,
    html: layout(
      `Você foi convidado(a) para ${parishName}`,
      `<p style="margin:0 0 12px">Seu acesso será de <strong>${roleLabel}</strong>.</p>
       ${button(url, "Aceitar convite")}
       <p style="margin:0;font-size:13px;color:#525252">O convite vale por 14 dias.</p>`,
    ),
  };
}
